#!/bin/sh
# Handle dynamic port from Render
if [ -n "$PORT" ]; then
  export GF_SERVER_HTTP_PORT="$PORT"
fi

# Replace Prometheus URL in datasource config if environment variable is set
if [ -n "$PROMETHEUS_URL" ]; then
  sed -i "s|https://YOUR_PROMETHEUS_SERVICE_URL_HERE.onrender.com|$PROMETHEUS_URL|g" /etc/grafana/provisioning/datasources/prometheus.render.yml
fi

# Run Grafana
exec grafana-server run

