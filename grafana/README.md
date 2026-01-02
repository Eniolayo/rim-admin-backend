# Grafana Dashboard Configuration

This directory contains Grafana provisioning configuration for the RIM Backend monitoring setup.

## Structure

```
grafana/
├── provisioning/
│   ├── datasources/
│   │   └── prometheus.yml          # Prometheus datasource configuration
│   └── dashboards/
│       ├── dashboard.yml           # Dashboard provider configuration
│       └── rim-backend-dashboard.json  # Main dashboard JSON
└── README.md
```

## Setup

The Grafana service in `docker-compose.dev.yml` is configured to automatically load:

1. **Datasources**: Prometheus connection is automatically configured
2. **Dashboards**: The RIM Backend dashboard is automatically loaded into the "RIM" folder

## Access

- **Grafana URL**: http://localhost:3001
- **Default Credentials**: 
  - Username: `admin`
  - Password: `admin`

## Dashboard Panels

The `rim-backend-dashboard.json` includes the following panels:

1. **Request Rate** - Requests per second by method, route, and status code
2. **Error Rate** - Error requests per second
3. **Response Time Percentiles**:
   - p50 (median)
   - p95 (95th percentile)
   - p99 (99th percentile)
4. **Statistics**:
   - Total requests (last hour)
   - Total errors (last hour)
   - Slow requests >200ms (last hour)
   - Error rate percentage
5. **Request Rate by Status Code** - Breakdown by HTTP status codes
6. **Top 10 Routes by Request Rate** - Table view of most active endpoints

## Metrics Available

The dashboard uses the following Prometheus metrics:

- `http_requests_total` - Counter of total HTTP requests
- `http_request_errors_total` - Counter of HTTP errors (4xx, 5xx)
- `http_request_duration_seconds` - Histogram of request durations
- `http_slow_requests_total` - Counter of slow requests (>200ms)

These metrics are collected by the `MetricsService` and `PerformanceInterceptor` in the application.

## Updating Dashboards

To update dashboards:

1. Edit the JSON file in `grafana/provisioning/dashboards/`
2. Restart the Grafana container: `docker-compose restart grafana`
3. Or reload Grafana provisioning (Grafana will auto-reload every 10 seconds)

## Notes

- Dashboard provisioning is configured with `updateIntervalSeconds: 10`, so changes are picked up automatically
- The dashboard uses Grafana schema version 38 (compatible with Grafana 9.0+)
- All panels use the Prometheus datasource configured in `datasources/prometheus.yml`



