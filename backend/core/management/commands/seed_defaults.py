from django.core.management.base import BaseCommand
from core.models import PaymentMethod

class Command(BaseCommand):
    help = 'Seeds default payment methods'

    def handle(self, *args, **options):
        methods = [
            {'method': 'cash', 'is_enabled': True},
            {'method': 'card', 'is_enabled': True},
            {'method': 'upi', 'is_enabled': True, 'upi_id': 'cafeflow@upi'},
        ]
        for item in methods:
            obj, created = PaymentMethod.objects.get_or_create(
                method=item['method'],
                defaults={
                    'is_enabled': item['is_enabled'],
                    'upi_id': item.get('upi_id')
                }
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f"Created payment method: {item['method']}"))
            else:
                self.stdout.write(f"Payment method {item['method']} already exists.")
