import re

from django.core.exceptions import ValidationError

# Egyptian numbers: mobile 010/011/012/015 (+8 digits) or landline (02x etc.),
# with a national trunk 0, +20, or 0020 prefix. Separators are stripped first.
EGYPT_PHONE_RE = re.compile(r"^(?:\+20|0020|0)(?:1[0125]\d{8}|[2-9]\d{7,8})$")
_SEPARATORS = re.compile(r"[\s\-().]")


def normalize_egyptian_phone(value: str) -> str:
    """Strip separators and require an Egyptian format; blank stays blank."""
    cleaned = _SEPARATORS.sub("", value or "")
    if cleaned and not EGYPT_PHONE_RE.match(cleaned):
        raise ValidationError(
            "Enter a valid Egyptian phone number (e.g. 01012345678 or +201012345678)."
        )
    return cleaned


def egyptian_phone_validator(value: str) -> None:
    """Django field validator — used by model full_clean paths."""
    normalize_egyptian_phone(value)
