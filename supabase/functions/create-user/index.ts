import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateUserPayload {
  email: string;
  password?: string; // ignorado — sempre geramos senha temporária
  nome?: string;
  cod_empresa_bi?: string;
  filial_id?: string | null;
  filiais_permitidas?: string[];
  role: 'master' | 'gerencial' | 'vendedor';
  module_permissions: {
    modulo_dre: boolean;
    modulo_variacao: boolean;
    modulo_comercial: boolean;
    modulo_assistente_ia: boolean;
    modulo_whatsapp: boolean;
    modulo_operacional: boolean;
    modulo_resumo: boolean;
    permissoes_paginas?: Record<string, boolean>;
  };
}

function generateTempPassword(len = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*?';
  const all = upper + lower + digits + symbols;
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  const pick = (set: string, b: number) => set[b % set.length];
  const chars = [
    pick(upper, bytes[0]),
    pick(lower, bytes[1]),
    pick(digits, bytes[2]),
    pick(symbols, bytes[3]),
  ];
  for (let i = 4; i < len; i++) chars.push(pick(all, bytes[i]));
  // embaralhar
  for (let i = chars.length - 1; i > 0; i--) {
    const j = bytes[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function isSchemaCacheColumnError(error: unknown, columns: string[]): boolean {
  const supabaseError = error as { code?: string; message?: string; details?: string };
  const errorText = [
    supabaseError?.code,
    supabaseError?.message,
    supabaseError?.details,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    columns.some((column) => errorText.includes(column.toLowerCase())) &&
    (errorText.includes('schema cache') ||
      errorText.includes('could not find') ||
      supabaseError?.code === 'PGRST204')
  );
}

function getMissingSchemaColumns(error: unknown, columns: string[]): string[] {
  const supabaseError = error as { code?: string; message?: string; details?: string };
  const errorText = [
    supabaseError?.code,
    supabaseError?.message,
    supabaseError?.details,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (
    !errorText.includes('schema cache') &&
    !errorText.includes('could not find') &&
    supabaseError?.code !== 'PGRST204'
  ) {
    return [];
  }

  return columns.filter((column) => errorText.includes(column.toLowerCase()));
}

async function upsertProfileWithFallback(
  supabaseAdmin: ReturnType<typeof createClient>,
  profilePayload: Record<string, unknown>,
) {
  const optionalColumns = ['filiais_permitidas', 'filial_id', 'must_change_password'];
  let payload = { ...profilePayload };

  for (let attempt = 0; attempt <= optionalColumns.length; attempt++) {
    const { error } = await supabaseAdmin
      .from('profiles')
      .upsert(payload, { onConflict: 'user_id' });

    if (!error) return;

    const missingColumns = getMissingSchemaColumns(error, optionalColumns);
    if (missingColumns.length === 0) {
      throw error;
    }

    for (const column of missingColumns) {
      delete payload[column];
    }
    console.warn('Profile columns are unavailable in schema cache; retrying without:', missingColumns);
  }
}

async function upsertModulePermissions(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  modulePermissions: CreateUserPayload['module_permissions'] | undefined,
) {
  const basePayload = {
    user_id: userId,
    modulo_dre: modulePermissions?.modulo_dre ?? false,
    modulo_variacao: modulePermissions?.modulo_variacao ?? false,
    modulo_comercial: modulePermissions?.modulo_comercial ?? false,
    modulo_assistente_ia: modulePermissions?.modulo_assistente_ia ?? false,
    modulo_whatsapp: modulePermissions?.modulo_whatsapp ?? false,
  };

  const fullPayload = {
    ...basePayload,
    modulo_operacional: modulePermissions?.modulo_operacional ?? false,
    modulo_resumo: modulePermissions?.modulo_resumo ?? false,
    permissoes_paginas: modulePermissions?.permissoes_paginas ?? {},
  };

  const { error } = await supabaseAdmin
    .from('user_module_permissions')
    .upsert(fullPayload, { onConflict: 'user_id' });

  if (!error) return;

  if (!isSchemaCacheColumnError(error, ['modulo_operacional', 'modulo_resumo', 'permissoes_paginas'])) {
    throw error;
  }

  console.warn('Some permission columns are unavailable in schema cache; saving compatible module permissions payload.');
  const { error: fallbackError } = await supabaseAdmin
    .from('user_module_permissions')
    .upsert(basePayload, { onConflict: 'user_id' });

  if (fallbackError) throw fallbackError;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let supabaseAdmin: ReturnType<typeof createClient> | null = null;
  let createdUserId: string | null = null;
  let step = 'start';

  try {
    step = 'read_auth_header';
    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    step = 'init_clients';
    // Create supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Client for verifying the caller's permissions
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Admin client for creating users
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    step = 'verify_auth_claims';
    // Verify caller is authenticated using getClaims (works with JWT tokens)
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: authError } = await supabaseAuth.auth.getClaims(token);
    
    if (authError || !claimsData?.claims) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    step = 'fetch_caller_roles';
    const callerId = claimsData.claims.sub;

    // Check caller's role
    const { data: callerRoles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId);

    if (rolesError) {
      console.error('Error fetching caller roles:', rolesError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify permissions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callerRolesList = callerRoles?.map(r => r.role) || [];
    const isMaster = callerRolesList.includes('master');
    const isGerencial = callerRolesList.includes('gerencial');

    if (!isMaster && !isGerencial) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions to create users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get caller's company for gerencial validation
    let callerCompany: string | null = null;
    if (isGerencial && !isMaster) {
      step = 'fetch_caller_company';
      const { data: callerProfile } = await supabaseAdmin
        .from('profiles')
        .select('cod_empresa_bi')
        .eq('user_id', callerId)
        .single();
      callerCompany = callerProfile?.cod_empresa_bi || null;
    }

    step = 'parse_payload';
    // Parse request body
    const payload: CreateUserPayload = await req.json();
    const { email, nome, cod_empresa_bi, filial_id, filiais_permitidas, role, module_permissions } = payload;

    // Validate required fields
    if (!email || !role) {
      return new Response(
        JSON.stringify({ error: 'Email and role are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sempre geramos uma senha temporária segura — administrador nunca digita senha
    const tempPassword = generateTempPassword(12);

    // Gerencial can only create vendedores in their own company
    if (!isMaster && isGerencial) {
      if (role !== 'vendedor') {
        return new Response(
          JSON.stringify({ error: 'You can only create vendedor users' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (cod_empresa_bi && cod_empresa_bi !== callerCompany) {
        return new Response(
          JSON.stringify({ error: 'You can only create users for your own company' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Non-master roles require company
    if (role !== 'master' && !cod_empresa_bi) {
      return new Response(
        JSON.stringify({ error: 'Company is required for non-master users' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Creating user:', { email, nome, cod_empresa_bi, role });

    const filiaisPermitidas = role === 'master'
      ? []
      : Array.isArray(filiais_permitidas)
        ? filiais_permitidas.filter(Boolean)
        : filial_id
          ? [filial_id]
          : [];
    const filialPadrao = filiaisPermitidas.length === 1 ? filiaisPermitidas[0] : null;

    step = 'create_auth_user';
    // Create user using admin API (does NOT auto-login)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true, // Auto-confirm email
    });

    if (createError) {
      console.error('Error creating user:', createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!newUser.user) {
      return new Response(
        JSON.stringify({ error: 'Failed to create user' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = newUser.user.id;
    createdUserId = userId;
    console.log('User created with ID:', userId);

    step = 'update_profile';
    // Upsert profile with additional data + must_change_password.
    // This does not depend on the auth trigger timing and tolerates older schemas.
    const profilePayload = {
      user_id: userId,
      email,
      nome: nome || null,
      cod_empresa_bi: role === 'master' ? null : cod_empresa_bi,
      filial_id: filialPadrao,
      filiais_permitidas: filiaisPermitidas,
      must_change_password: true,
    };

    try {
      await upsertProfileWithFallback(supabaseAdmin, profilePayload);
    } catch (profileError) {
      console.error('Error saving profile:', profileError);
      const detail = profileError instanceof Error ? profileError.message : JSON.stringify(profileError);
      throw new Error(`Failed to save user profile: ${detail}`);
    }

    step = 'insert_role';
    // Add user role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: userId, role });

    if (roleError) {
      console.error('Error adding role:', roleError);
      throw new Error('Failed to assign user role');
    }

    step = 'upsert_module_permissions';
    // Add module permissions
    try {
      await upsertModulePermissions(supabaseAdmin, userId, module_permissions);
    } catch (permError) {
      console.error('Error adding module permissions:', permError);
      throw new Error('Failed to save module permissions');
    }

    console.log('User setup complete:', userId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: userId,
        temp_password: tempPassword,
        message: 'User created successfully' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';

    if (supabaseAdmin && createdUserId) {
      try {
        console.warn('Rolling back partially created user:', createdUserId);
        await supabaseAdmin
          .from('user_module_permissions')
          .delete()
          .eq('user_id', createdUserId);
        await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', createdUserId);
        await supabaseAdmin
          .from('profiles')
          .delete()
          .eq('user_id', createdUserId);
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError);
      }
    }

    return new Response(
      JSON.stringify({
        error: `Falha ao criar usuário na etapa ${step}: ${message}`,
        step,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
