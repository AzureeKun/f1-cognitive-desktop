"""Generate combined CA bundle from certifi + Windows system certs"""
import ssl, certifi, os, base64

ctx = ssl.create_default_context()
system_certs = ctx.get_ca_certs(binary_form=True)

# Start with certifi bundle
combined = open(certifi.where(), 'rb').read()

# Append Windows system certs as PEM
for der_cert in system_certs:
    pem = b'-----BEGIN CERTIFICATE-----\n'
    pem += base64.encodebytes(der_cert)
    pem += b'-----END CERTIFICATE-----\n'
    combined += pem

out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'roots.pem')
with open(out_path, 'wb') as f:
    f.write(combined)

count = combined.count(b'BEGIN CERTIFICATE')
print(f'Generated roots.pem: {count} certificates, {len(combined)} bytes')
print(f'Path: {out_path}')
