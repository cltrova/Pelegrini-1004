// Mapeamento de fotos de perfil dos vendedores por nome
import rodrigoZanetti from '@/assets/vendedores/rodrigo-zanetti.png';
import filipeRisso from '@/assets/vendedores/filipe-risso.png';
import viniciusBatista from '@/assets/vendedores/vinicius-batista.png';

// Normaliza o nome para comparação (lowercase, sem acentos, sem espaços extras)
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

const avatarMap: Record<string, string> = {
  'rodrigo zanetti': rodrigoZanetti,
  'filipe risso': filipeRisso,
  'vinicius batista': viniciusBatista,
};

export function getVendedorAvatar(nome: string): string | undefined {
  const normalized = normalizeName(nome);
  
  // Busca exata primeiro
  if (avatarMap[normalized]) {
    return avatarMap[normalized];
  }
  
  // Busca parcial (caso o nome venha com sobrenome diferente)
  for (const [key, value] of Object.entries(avatarMap)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }
  
  return undefined;
}
