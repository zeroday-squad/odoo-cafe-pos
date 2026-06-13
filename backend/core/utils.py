from django.utils import timezone
from datetime import timedelta

def apply_report_filters(queryset, params):
    """
    Filters a paid Order queryset based on request query params.
    Called by every single report view — single source of truth for filtering.

    Supported params:
      period     = 'today' | 'week' | 'month' | 'custom'
      start_date = 'YYYY-MM-DD'  (used with period='custom')
      end_date   = 'YYYY-MM-DD'  (used with period='custom')
      employee   = <user_id>
      session    = <session_id>
      product    = <product_id>
    """
    period     = params.get('period')
    start_date = params.get('start_date')
    end_date   = params.get('end_date')
    employee   = params.get('employee')
    session    = params.get('session')
    product    = params.get('product')

    now = timezone.now()

    if period == 'today':
        queryset = queryset.filter(created_at__date=now.date())
    elif period == 'week':
        queryset = queryset.filter(created_at__gte=now - timedelta(days=7))
    elif period == 'month':
        queryset = queryset.filter(created_at__gte=now - timedelta(days=30))
    elif period == 'custom' and start_date and end_date:
        queryset = queryset.filter(created_at__date__range=[start_date, end_date])

    if employee:
        queryset = queryset.filter(employee_id=employee)
    if session:
        queryset = queryset.filter(session_id=session)
    if product:
        queryset = queryset.filter(items__product_id=product)

    return queryset


def generate_order_number():
    """
    Utility to generate the next order number in CF-XXXX format.
    Used by Phase 2 order creation logic.
    """
    from core.models import Order
    last = Order.objects.order_by('-created_at').first()
    num  = (int(last.order_number.split('-')[1]) + 1) if last else 1
    return f'CF-{num:04d}'
