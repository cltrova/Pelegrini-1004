"""Windows RSYS to the private report listener on the VPS."""
from pathlib import Path
import select
import socket
import sys
import threading
import time

import paramiko


KEY = Path(__file__).with_name('relatorios-ssh')
HOST_KEY = 'AAAAC3NzaC1lZDI1NTE5AAAAIFy7xXok3ngMujMxfu8kfBTgcihmyt0f+or0FfcJBPU/'


class HostKey(paramiko.MissingHostKeyPolicy):
    def missing_host_key(self, client, hostname, key):
        if key.get_name() != 'ssh-ed25519' or key.get_base64() != HOST_KEY:
            raise paramiko.SSHException('A chave do VPS mudou')


def relay(channel, slots):
    try:
        channel.settimeout(8)
        with socket.create_connection(('192.168.141.102', 1433), timeout=8) as sql:
            while True:
                ready, _, _ = select.select([channel, sql], [], [], 60)
                for source, target in ((channel, sql), (sql, channel)):
                    if source in ready:
                        block = source.recv(64 * 1024)
                        if not block:
                            return
                        target.sendall(block)
                if not ready:
                    return
    except (OSError, EOFError, paramiko.SSHException):
        pass
    finally:
        channel.close()
        slots.release()


def main():
    if sys.argv[1:] == ['--public-key']:
        if not KEY.is_file():
            paramiko.RSAKey.generate(3072).write_private_key_file(str(KEY))
        key = paramiko.RSAKey.from_private_key_file(str(KEY))
        print(f'{key.get_name()} {key.get_base64()}')
        return
    slots = threading.BoundedSemaphore(4)
    while True:
        try:
            with paramiko.SSHClient() as client:
                client.set_missing_host_key_policy(HostKey())
                client.connect('187.77.203.16', 22, 'pelegrini-tunnel',
                               pkey=paramiko.RSAKey.from_private_key_file(str(KEY)), timeout=12,
                               auth_timeout=12, banner_timeout=12, allow_agent=False, look_for_keys=False)
                transport = client.get_transport()
                transport.set_keepalive(15)
                transport.request_port_forward('127.0.0.1', 15007)
                print('Tunel SQL de Relatorios conectado.', flush=True)
                while transport.is_active():
                    channel = transport.accept(10)
                    if channel and slots.acquire(blocking=False):
                        threading.Thread(target=relay, args=(channel, slots), daemon=True).start()
                    elif channel:
                        channel.close()
        except (OSError, EOFError, paramiko.SSHException) as error:
            print(f'Tunel SQL indisponivel ({type(error).__name__}).', flush=True)
        time.sleep(12)


if __name__ == '__main__':
    main()
