# Prometheus Alert Rules

This directory contains Prometheus alerting rules for the RIM Backend monitoring setup.

## Structure

```
prometheus/
├── alerts/
│   └── alert-rules.yml    # Alert rules configuration
└── README.md
```

## Alert Rules

The `alert-rules.yml` file defines the following alerts:

### HighErrorRate (Warning)
- **Condition**: Error rate > 5% for 5 minutes
- **Severity**: Warning
- **Description**: Triggers when the percentage of error requests exceeds 5%

### VeryHighErrorRate (Critical)
- **Condition**: Error rate > 10% for 2 minutes
- **Severity**: Critical
- **Description**: Triggers when the percentage of error requests exceeds 10%

### SlowResponseTime (Warning)
- **Condition**: 95th percentile latency > 500ms for 5 minutes
- **Severity**: Warning
- **Description**: Triggers when 95% of requests take longer than 500ms

### VerySlowResponseTime (Critical)
- **Condition**: 95th percentile latency > 1s for 2 minutes
- **Severity**: Critical
- **Description**: Triggers when 95% of requests take longer than 1 second

### HighSlowRequestRate (Warning)
- **Condition**: Slow request rate (>200ms) > 10 req/s for 5 minutes
- **Severity**: Warning
- **Description**: Triggers when there are more than 10 slow requests per second

### NoRequestsReceived (Warning)
- **Condition**: No requests received for 10 minutes
- **Severity**: Warning
- **Description**: Triggers when the application appears to be down or not receiving traffic

## Configuration

The alert rules are loaded by Prometheus via the `prometheus.yml` configuration file:

```yaml
rule_files:
  - /etc/prometheus/alerts/*.yml
```

## Viewing Alerts

To view active alerts:

1. Access Prometheus UI: http://localhost:9090
2. Navigate to the "Alerts" tab
3. View alert status and details

## Alertmanager Integration

To send alerts to external systems (email, Slack, PagerDuty, etc.), you'll need to:

1. Set up Alertmanager
2. Configure Prometheus to send alerts to Alertmanager
3. Configure Alertmanager notification channels

This is a separate step beyond the current setup.

## Customizing Alerts

To customize alert thresholds:

1. Edit `prometheus/alerts/alert-rules.yml`
2. Modify the `expr` (expression) or `for` (duration) values
3. Restart Prometheus: `docker-compose restart prometheus`

## Testing Alerts

To test alerts:

1. Generate load with errors: Use the performance test scripts
2. Check Prometheus UI: http://localhost:9090/alerts
3. Verify alerts trigger at the configured thresholds


