# TLS 1.3 Configuration Guide

This document describes how to configure TLS 1.3 support for the RIM Admin Backend API.

## Overview

TLS 1.3 is the latest version of the Transport Layer Security protocol, providing enhanced security and performance compared to TLS 1.2. All RIM API endpoints support TLS 1.3 and require it in production environments.

## Requirements

- **Minimum TLS Version**: TLS 1.3 (recommended) or TLS 1.2 (minimum)
- **Production**: TLS 1.3 is required
- **Development**: TLS 1.2+ is acceptable for local development

## Server Configuration

### Node.js/Express (NestJS)

The application runs on Node.js with NestJS/Express. TLS configuration is typically handled at the reverse proxy/load balancer level (Nginx, AWS ALB, etc.) rather than in the application code.

### Recommended Setup: Reverse Proxy (Nginx)

For production deployments, use Nginx as a reverse proxy with TLS 1.3:

```nginx
server {
    listen 443 ssl http2;
    server_name api.rim.ng;

    # TLS 1.3 Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    
    # TLS 1.3 Cipher Suites (automatically selected by TLS 1.3)
    ssl_ciphers 'TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384';
    
    # Modern SSL Configuration
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets off;
    
    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    
    # Certificate Configuration
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name api.rim.ng;
    return 301 https://$server_name$request_uri;
}
```

### AWS Application Load Balancer (ALB)

If using AWS ALB:

1. **Create SSL Certificate** in AWS Certificate Manager (ACM)
2. **Configure Listener**:
   - Protocol: HTTPS
   - Port: 443
   - SSL Certificate: Your ACM certificate
   - Security Policy: `ELBSecurityPolicy-TLS13-1-2-2021-06` (supports TLS 1.3)

3. **Security Group**: Allow inbound traffic on port 443

### Docker/Container Deployment

If running in Docker with direct TLS:

```dockerfile
# Dockerfile example (not recommended for production)
# Use reverse proxy instead

FROM node:20-alpine

# Install OpenSSL with TLS 1.3 support
RUN apk add --no-cache openssl

# Copy application
COPY . /app
WORKDIR /app

# Generate self-signed certificate for development (DO NOT USE IN PRODUCTION)
RUN openssl req -x509 -newkey rsa:4096 -nodes \
    -keyout /app/certs/key.pem \
    -out /app/certs/cert.pem \
    -days 365 \
    -subj "/C=NG/ST=Lagos/L=Lagos/O=RIM/CN=api.rim.ng"

EXPOSE 443

CMD ["node", "dist/src/main.js"]
```

**Note**: For production, always use a reverse proxy (Nginx, Traefik, etc.) or managed load balancer.

## Application-Level Configuration

While TLS is typically handled at the infrastructure level, you can enforce TLS requirements in the application:

### Environment Variables

```bash
# Require HTTPS in production
REQUIRE_HTTPS=true

# Minimum TLS version (enforced by reverse proxy)
TLS_MIN_VERSION=1.3
```

### Express Middleware (Optional)

Add to `main.ts` if you need application-level TLS enforcement:

```typescript
// Enforce HTTPS in production
if (nodeEnv === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      return res.redirect(`https://${req.header('host')}${req.url}`);
    }
    next();
  });
}
```

## Testing TLS 1.3

### Using OpenSSL

```bash
# Test TLS 1.3 connection
openssl s_client -connect api.rim.ng:443 -tls1_3

# Check supported protocols
openssl s_client -connect api.rim.ng:443 -showcerts
```

### Using curl

```bash
# Force TLS 1.3
curl --tlsv1.3 https://api.rim.ng/api/health

# Check TLS version used
curl -v --tlsv1.3 https://api.rim.ng/api/health 2>&1 | grep -i "TLS"
```

### Online Tools

- **SSL Labs SSL Test**: https://www.ssllabs.com/ssltest/
- **SSL Checker**: https://www.sslshopper.com/ssl-checker.html

## Certificate Management

### Let's Encrypt (Recommended for Production)

```bash
# Install Certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d api.rim.ng

# Auto-renewal (already configured by Certbot)
sudo certbot renew --dry-run
```

### Certificate Requirements

- **Validity**: Maximum 90 days (Let's Encrypt) or 1 year (commercial)
- **Key Size**: RSA 2048-bit minimum, RSA 4096-bit or ECDSA P-256 recommended
- **Chain**: Include full certificate chain
- **OCSP**: Enable OCSP stapling for better performance

## Security Best Practices

1. **Disable TLS 1.0 and TLS 1.1**: These are deprecated and insecure
2. **Use Strong Cipher Suites**: Prefer AES-GCM and ChaCha20-Poly1305
3. **Enable HSTS**: HTTP Strict Transport Security header
4. **OCSP Stapling**: Reduces certificate validation latency
5. **Perfect Forward Secrecy**: TLS 1.3 provides this by default
6. **Regular Updates**: Keep TLS libraries and certificates updated

## Compliance

TLS 1.3 support ensures compliance with:

- **PCI DSS**: Requirement 4.1 (Encrypt transmission of cardholder data)
- **GDPR**: Article 32 (Security of processing)
- **ISO 27001**: A.13.1.1 (Network controls)
- **NIST Guidelines**: SP 800-52 Rev. 2 (TLS recommendations)

## Monitoring

Monitor TLS configuration:

- **Certificate Expiry**: Set up alerts for certificate expiration
- **TLS Version Usage**: Track which TLS versions clients are using
- **Cipher Suite Usage**: Monitor cipher suite selection
- **Connection Failures**: Alert on TLS handshake failures

## Troubleshooting

### Common Issues

1. **TLS 1.3 Not Available**:
   - Check OpenSSL version (1.1.1+ required)
   - Verify Nginx version (1.13.0+ required)
   - Check server configuration

2. **Certificate Errors**:
   - Verify certificate chain is complete
   - Check certificate expiration
   - Ensure certificate matches domain

3. **Connection Refused**:
   - Verify firewall rules
   - Check security group settings
   - Ensure port 443 is open

## References

- [TLS 1.3 Specification (RFC 8446)](https://tools.ietf.org/html/rfc8446)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
- [NIST Guidelines for TLS](https://csrc.nist.gov/publications/detail/sp/800-52/rev-2/final)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)

## Support

For TLS configuration assistance, contact the DevOps team or refer to the infrastructure documentation.
