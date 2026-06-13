import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin

class UserManager(BaseUserManager):
    def create_user(self, email, name, password=None, role='cashier', **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, name=name, role=role, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, name, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, name, password, role='admin', **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('cashier', 'Cashier'),
        ('kitchen', 'Kitchen'),
    ]

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name        = models.CharField(max_length=100)
    email       = models.EmailField(unique=True)
    role        = models.CharField(max_length=20, choices=ROLE_CHOICES, default='cashier')
    is_archived = models.BooleanField(default=False)
    is_active   = models.BooleanField(default=True)
    is_staff    = models.BooleanField(default=False)
    created_at  = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = ['name']

    objects = UserManager()

    def __str__(self):
        return f'{self.name} ({self.email})'


class Category(models.Model):
    id    = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name  = models.CharField(max_length=100, unique=True)
    color = models.CharField(max_length=7, default='#6366f1')  # hex color e.g. #ff5733

    def __str__(self):
        return self.name


class Product(models.Model):
    UNIT_CHOICES = [
        ('piece', 'Per Piece'),
        ('kg',    'Per KG'),
        ('litre', 'Per Litre'),
    ]

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name        = models.CharField(max_length=200)
    category    = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    price       = models.DecimalField(max_digits=10, decimal_places=2)
    unit        = models.CharField(max_length=10, choices=UNIT_CHOICES, default='piece')
    tax         = models.DecimalField(max_digits=5, decimal_places=2, default=0)
                  # tax stored as percentage — e.g. 5.00 means 5%
    description = models.TextField(blank=True)
    show_in_kds = models.BooleanField(default=True)
    is_active   = models.BooleanField(default=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Floor(models.Model):
    id   = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name


class Table(models.Model):
    id        = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    floor     = models.ForeignKey(Floor, on_delete=models.CASCADE, related_name='tables')
    number    = models.PositiveIntegerField()
    seats     = models.PositiveIntegerField(default=4)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = [('floor', 'number')]
        # Enforced at DB level — same table number cannot repeat on same floor

    def __str__(self):
        return f'Table {self.number} ({self.floor.name})'


class PaymentMethod(models.Model):
    METHOD_CHOICES = [
        ('cash', 'Cash'),
        ('card', 'Card'),
        ('upi',  'UPI'),
    ]

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    method     = models.CharField(max_length=10, choices=METHOD_CHOICES, unique=True)
    is_enabled = models.BooleanField(default=True)
    upi_id     = models.CharField(max_length=100, blank=True, null=True)
               # upi_id is only relevant when method='upi'

    def __str__(self):
        return self.method


class Coupon(models.Model):
    DISCOUNT_TYPE_CHOICES = [
        ('percent', 'Percentage'),
        ('fixed',   'Fixed Amount'),
    ]

    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code           = models.CharField(max_length=50, unique=True)
    discount_type  = models.CharField(max_length=10, choices=DISCOUNT_TYPE_CHOICES)
    discount_value = models.DecimalField(max_digits=10, decimal_places=2)
    is_active      = models.BooleanField(default=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.code


class Promotion(models.Model):
    PROMO_TYPE_CHOICES = [
        ('product', 'Product Level'),
        ('order',   'Order Level'),
    ]
    DISCOUNT_TYPE_CHOICES = [
        ('percent', 'Percentage'),
        ('fixed',   'Fixed Amount'),
    ]

    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name             = models.CharField(max_length=200)
    promo_type       = models.CharField(max_length=10, choices=PROMO_TYPE_CHOICES)
    product          = models.ForeignKey(Product, on_delete=models.SET_NULL,
                                         null=True, blank=True)
                       # only used when promo_type='product'
    min_quantity     = models.PositiveIntegerField(null=True, blank=True)
                       # required when promo_type='product'
    min_order_amount = models.DecimalField(max_digits=10, decimal_places=2,
                                           null=True, blank=True)
                       # required when promo_type='order'
    discount_type    = models.CharField(max_length=10, choices=DISCOUNT_TYPE_CHOICES)
    discount_value   = models.DecimalField(max_digits=10, decimal_places=2)
    is_active        = models.BooleanField(default=True)
    created_at       = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class POSSession(models.Model):
    STATUS_CHOICES = [
        ('open',   'Open'),
        ('closed', 'Closed'),
    ]

    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    opened_by      = models.ForeignKey('User', on_delete=models.SET_NULL, null=True)
    opened_at      = models.DateTimeField(auto_now_add=True)
    closed_at      = models.DateTimeField(null=True, blank=True)
    status         = models.CharField(max_length=10, choices=STATUS_CHOICES, default='open')
    closing_amount = models.DecimalField(max_digits=10, decimal_places=2,
                                         null=True, blank=True)

    def __str__(self):
        return f'Session {self.id} ({self.status})'


class Customer(models.Model):
    id    = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name  = models.CharField(max_length=200)
    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)

    def __str__(self):
        return self.name


class Order(models.Model):
    STATUS_CHOICES = [
        ('draft',     'Draft'),
        ('paid',      'Paid'),
        ('cancelled', 'Cancelled'),
    ]
    KDS_STATUS_CHOICES = [
        ('pending',    'Pending'),
        ('to_cook',    'To Cook'),
        ('preparing',  'Preparing'),
        ('completed',  'Completed'),
    ]

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order_number = models.CharField(max_length=20, unique=True, blank=True)
                   # auto-generated in save() — format: CF-0001
    session      = models.ForeignKey(POSSession, on_delete=models.SET_NULL, null=True,
                                     related_name='orders')
    table        = models.ForeignKey(Table, on_delete=models.SET_NULL, null=True)
    customer     = models.ForeignKey(Customer, on_delete=models.SET_NULL,
                                     null=True, blank=True)
    employee     = models.ForeignKey('User', on_delete=models.SET_NULL, null=True)
    status       = models.CharField(max_length=15, choices=STATUS_CHOICES, default='draft')
    kds_status   = models.CharField(max_length=15, choices=KDS_STATUS_CHOICES, default='pending')
    subtotal     = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tax_amount   = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount     = models.DecimalField(max_digits=10, decimal_places=2, default=0)
                   # total discount = promo discount + coupon discount combined
    total        = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    coupon       = models.ForeignKey(Coupon, on_delete=models.SET_NULL, null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.order_number:
            last = Order.objects.order_by('-created_at').first()
            num = (int(last.order_number.split('-')[1]) + 1) if last else 1
            self.order_number = f'CF-{num:04d}'
        super().save(*args, **kwargs)

    def __str__(self):
        return self.order_number


class OrderItem(models.Model):
    KDS_STATUS_CHOICES = [
        ('pending',   'Pending'),
        ('completed', 'Completed'),
    ]

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order      = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product    = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True)
    quantity   = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    line_total = models.DecimalField(max_digits=10, decimal_places=2)
    discount   = models.DecimalField(max_digits=10, decimal_places=2, default=0)
               # promo discount applied to this specific line item
    kds_status = models.CharField(max_length=15, choices=KDS_STATUS_CHOICES, default='pending')

    def __str__(self):
        return f'{self.product} x{self.quantity}'


class Payment(models.Model):
    METHOD_CHOICES = [
        ('cash', 'Cash'),
        ('card', 'Card'),
        ('upi',  'UPI'),
    ]

    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order           = models.OneToOneField(Order, on_delete=models.CASCADE,
                                           related_name='payment')
    method          = models.CharField(max_length=10, choices=METHOD_CHOICES)
    amount_paid     = models.DecimalField(max_digits=10, decimal_places=2)
    change_due      = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    transaction_ref = models.CharField(max_length=200, blank=True)
    paid_at         = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Payment for {self.order.order_number}'
