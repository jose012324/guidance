from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'accounts'
    verbose_name = 'Accounts & Authentication'

    def ready(self):
        # Import signal handlers
        from . import signals  # noqa: F401
