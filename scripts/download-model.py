"""Download the documented upstream TorchScript model with SHA-256 verification."""
import hashlib
from pathlib import Path
from urllib.request import urlopen

URL = 'https://github.com/enesmsahin/simple-lama-inpainting/releases/download/v0.1.0/big-lama.pt'
SHA256 = '7ba7aa7ac37a4d41fdbbeba3a2af7ead18058552997e3a3cd1a3b2210c9e6b4c'
TARGET = Path(__file__).resolve().parents[1] / 'models' / 'big-lama.pt'

def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

def main():
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    if TARGET.exists():
        if digest(TARGET) != SHA256:
            raise SystemExit('Existing model checksum mismatch; move it aside before retrying.')
        print('Model checksum verified')
        return
    temporary = TARGET.with_suffix('.pt.part')
    try:
        print('Downloading ~206 MB from upstream GitHub release...')
        with urlopen(URL, timeout=120) as response, temporary.open('wb') as output:
            while block := response.read(1024 * 1024):
                output.write(block)
        if digest(temporary) != SHA256:
            raise RuntimeError('Downloaded model checksum mismatch')
        temporary.replace(TARGET)
        print('Model downloaded and verified')
    finally:
        temporary.unlink(missing_ok=True)

if __name__ == '__main__':
    main()
