"""TLS bridge for the productivity API; certificate and key stay on Windows."""
import datetime, ipaddress, os, ssl, http.client
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

ROOT = Path(r'C:\ApiSql\Produtividade_TLS')
CERT, KEY = ROOT / 'servidor.crt', ROOT / 'servidor.key'
ROOT.mkdir(parents=True, exist_ok=True)
if not CERT.exists() and not KEY.exists():
    key = rsa.generate_private_key(public_exponent=65537, key_size=3072)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'pelegrini-produtividade')])
    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
        .serial_number(x509.random_serial_number()).not_valid_before(now - datetime.timedelta(minutes=5))
        .not_valid_after(now + datetime.timedelta(days=365))
        .add_extension(x509.SubjectAlternativeName([x509.IPAddress(ipaddress.ip_address('189.112.3.29'))]), critical=False)
        .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
        .sign(key, hashes.SHA256()))
    KEY.write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    CERT.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
elif not CERT.exists() or not KEY.exists():
    raise RuntimeError('Certificado ou chave ausente; nao recrie automaticamente.')

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def do_GET(self):
        path = urlsplit(self.path)
        if path.path != '/operacional/produtividade/diario':
            self.send_error(404); return
        if len(self.path) > 4096 or len(self.headers.get('Authorization', '')) > 8192:
            self.send_error(400); return
        conn = http.client.HTTPConnection('127.0.0.1', int(os.getenv('PRODUTIVIDADE_PORTA_LOCAL', '5003')), timeout=120)
        try:
            conn.request('GET', self.path, headers={'Authorization': self.headers.get('Authorization', ''), 'Accept':'application/json'})
            res = conn.getresponse()
            body = res.read()
            self.send_response(res.status)
            self.send_header('Content-Type', res.getheader('Content-Type', 'application/json'))
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(body)
        except (OSError, http.client.HTTPException):
            self.send_error(502)
        finally:
            conn.close()

server = ThreadingHTTPServer(('127.0.0.1', 5004), Handler)
context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.minimum_version = ssl.TLSVersion.TLSv1_2
context.load_cert_chain(str(CERT), str(KEY))
server.socket = context.wrap_socket(server.socket, server_side=True)
print('TLS de teste ativo na porta 5004; certificado publico:', CERT, flush=True)
server.serve_forever()
