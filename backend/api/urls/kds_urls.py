from django.urls import path
from api.views.kds_views import KDSOrderListView, KDSAdvanceStatusView, KDSToggleItemView

urlpatterns = [
    path('orders/', KDSOrderListView.as_view()),
    path('orders/<uuid:pk>/status/', KDSAdvanceStatusView.as_view()),
    path('items/<uuid:pk>/status/', KDSToggleItemView.as_view()),
]
