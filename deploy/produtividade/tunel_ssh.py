"""Tunel reverso dedicado; chave privada e TLS permanecem no ERP."""
import base64, os, select, socket, sys, threading, time
from pathlib import Path
import paramiko

ROOT = Path(r'C:\ApiSql\Produtividade_TLS')
KEY = ROOT / 'tunel_rsa'
HOST_KEY = 'AAAAC3NzaC1lZDI1NTE5AAAAIFy7xXok3ngMujMxfu8kfBTgcihmyt0f+or0FfcJBPU/'
ROOT.mkdir(parents=True, exist_ok=True)
if len(sys.argv) > 1 and sys.argv[1] == '--preparar':
    if not KEY.exists():
        paramiko.RSAKey.generate(3072).write_private_key_file(str(KEY))
    key = paramiko.RSAKey.from_private_key_file(str(KEY))
    (ROOT / 'tunel_rsa.pub').write_text(f'{key.get_name()} {key.get_base64()} produtividade-tunel\n', encoding='ascii')
    print('Chave publica preparada:', ROOT / 'tunel_rsa.pub')
    sys.exit(0)

class Pinned(paramiko.MissingHostKeyPolicy):
    def missing_host_key(self, client, hostname, key):
        if key.get_name() != 'ssh-ed25519' or key.get_base64() != HOST_KEY:
            raise paramiko.SSHException('Chave da VPS nao confere')


def relay(channel):
    try:
        with socket.create_connection(('127.0.0.1', 5004), timeout=10) as target:
            target.settimeout(None)
            while True:
                ready, _, _ = select.select([channel, target], [], [], 60)
                if channel in ready:
                    data = channel.recv(32768)
                    if not data: break
                    target.sendall(data)
                if target in ready:
                    data = target.recv(32768)
                    if not data: break
                    channel.sendall(data)
    except (OSError, EOFError):
        pass
    finally:
        channel.close()

while True:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(Pinned())
    try:
        client.connect('187.77.203.16', port=22, username='pelegrini-tunnel',
            pkey=paramiko.RSAKey.from_private_key_file(str(KEY)), timeout=15,
            allow_agent=False, look_for_keys=False)
        transport = client.get_transport()
        transport.set_keepalive(20)
        transport.request_port_forward('127.0.0.1', 15004)
        print('Tunel conectado e restrito a VPS:127.0.0.1:15004', flush=True)
        while transport.is_active():
            channel = transport.accept(10)
            if channel: threading.Thread(target=relay, args=(channel,), daemon=True).start()
    except Exception as exc:
        print('Tunel indisponivel:', type(exc).__name__, str(exc), flush=True)
    finally:
        client.close()
    print('Tentando novamente em 10 segundos...', flush=True)
    time.sleep(10)
