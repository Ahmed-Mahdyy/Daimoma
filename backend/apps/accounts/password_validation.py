from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _


class UpperLowerDigitValidator:
    """Owner-approved password policy (D-009): at least one uppercase letter,
    one lowercase letter, and one digit. Combined with MinimumLengthValidator
    (12) and CommonPasswordValidator configured in settings."""

    def validate(self, password, user=None):
        if not any(c.isupper() for c in password):
            raise ValidationError(
                _("The password must contain at least one uppercase letter."),
                code="password_no_upper",
            )
        if not any(c.islower() for c in password):
            raise ValidationError(
                _("The password must contain at least one lowercase letter."),
                code="password_no_lower",
            )
        if not any(c.isdigit() for c in password):
            raise ValidationError(
                _("The password must contain at least one digit."),
                code="password_no_digit",
            )

    def get_help_text(self):
        return _(
            "Your password must contain at least one uppercase letter, "
            "one lowercase letter, and one digit."
        )
