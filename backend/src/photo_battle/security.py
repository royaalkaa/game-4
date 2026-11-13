import hashlib
import hmac
import secrets

SCRYPT_N = 2**14
SCRYPT_R = 8
SCRYPT_P = 1
SCRYPT_DKLEN = 32


def hash_admin_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(
        password.encode(), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P, dklen=SCRYPT_DKLEN
    )
    return f"scrypt:{SCRYPT_N}:{SCRYPT_R}:{SCRYPT_P}:{salt.hex()}:{digest.hex()}"


def verify_admin_password(password: str, stored: str) -> bool:
    _, n, r, p, salt_hex, digest_hex = stored.split(":")
    expected = bytes.fromhex(digest_hex)
    actual = hashlib.scrypt(
        password.encode(),
        salt=bytes.fromhex(salt_hex),
        n=int(n),
        r=int(r),
        p=int(p),
        maxmem=256 * 1024 * 1024,
        dklen=len(expected),
    )
    return hmac.compare_digest(actual, expected)


def new_token() -> str:
    return secrets.token_urlsafe(32)


def token_digest(secret_key: str, token: str) -> str:
    """HMAC-SHA256 от токена или кода входа: в БД лежит только он."""
    return hmac.new(secret_key.encode(), token.encode(), hashlib.sha256).hexdigest()
