from django.urls import path
from api.views.report_views import (
    SummaryView, SalesTrendView, TopProductsView,
    TopCategoriesView, TopOrdersView, ExportView
)

urlpatterns = [
    path('summary/', SummaryView.as_view()),
    path('sales-trend/', SalesTrendView.as_view()),
    path('top-products/', TopProductsView.as_view()),
    path('top-categories/', TopCategoriesView.as_view()),
    path('top-orders/', TopOrdersView.as_view()),
    path('export/', ExportView.as_view()),
]
