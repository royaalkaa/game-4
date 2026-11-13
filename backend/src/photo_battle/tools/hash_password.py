"""Печатает хеш пароля админа для ADMIN_PASSWORD_HASH. Пароль читается без эха."""

import getpass
import sys

from photo_battle.security import hash_admin_password


def main() -> int:
    first = getpass.getpass("Пароль админа: ")
    second = getpass.getpass("Повторите пароль: ")
    if not first:
        sys.stderr.write("Пароль не может быть пустым.\n")
        return 1
    if first != second:
        sys.stderr.write("Пароли не совпадают.\n")
        return 1
    sys.stdout.write(hash_admin_password(first) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
