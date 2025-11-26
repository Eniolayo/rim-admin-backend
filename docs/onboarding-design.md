# Onboarding API - Design Decisions & Long-Term Strategy

## Introduction

The onboarding API is the first touchpoint between new users and our platform. Every design decision we made balances three critical factors: **user experience**, **security**, and **operational excellence**. This document explains not just _what_ we built, but _why_ we built it this way, and how these decisions position us for future growth.

---

## The Big Picture: Why Session-Based Onboarding?

### The Problem We're Solving

Traditional stateless onboarding flows have a critical weakness: when something goes wrong, we have no visibility into what happened. A user might abandon the process at step 3, and we'd have no idea why. Was it a technical glitch? Did they get confused? Did they simply change their mind?

### Our Solution: Stateful Session Tracking

We chose a **session-based approach** where every onboarding journey is tracked from start to finish. This isn't just about storing data—it's about building operational capabilities that scale with our business.

**What this enables:**

1. **Issue Resolution**: When a user reports a problem, support agents can pull up their exact session, see where they got stuck, and help them complete the process without starting over.

2. **Proactive Support**: We can identify users with incomplete onboarding and reach out to help them finish. "We noticed you started creating an account but didn't complete it. Need help?"

3. **Security Monitoring**: Every action is logged and tracked. If we see suspicious patterns—like someone trying to create multiple accounts or repeatedly failing verification—we can detect and prevent fraud before it impacts our platform.

4. **Product Analytics**: Understanding where users drop off helps us improve the flow. Are people abandoning at BVN verification? Maybe we need clearer instructions or better error messages.

5. **Compliance & Auditing**: Financial regulations require us to track identity verification processes. Session data provides a complete audit trail of who verified what, when, and how.

**Technical Note**: Each session gets a unique UUID (`sessionId`) that persists across all steps. This allows the frontend to resume progress even if the user closes their browser and returns later.

---

## API Endpoints Overview

The onboarding flow is broken into 8 distinct endpoints, each serving a specific purpose in the user journey:

| Endpoint                                | Purpose                            | Why Separate?                                           |
| --------------------------------------- | ---------------------------------- | ------------------------------------------------------- |
| `POST /api/onboarding/start`            | Initialize or resume a session     | Allows users to return and continue where they left off |
| `POST /api/onboarding/country`          | Set user's country of residence    | Required for compliance and currency defaults           |
| `POST /api/onboarding/bvn`              | Verify Bank Verification Number    | Identity verification before account creation           |
| `POST /api/onboarding/send-otp`         | Send verification code to phone    | Proves phone ownership                                  |
| `POST /api/onboarding/verify-otp`       | Confirm phone ownership            | Security gate before account creation                   |
| `GET /api/onboarding/review/:sessionId` | Show collected data for review     | User confidence and data accuracy                       |
| `POST /api/onboarding/create-account`   | Finalize account creation          | Single point of account creation                        |
| `GET /api/onboarding/interests`         | Get available interest categories  | Product personalization                                 |
| `POST /api/onboarding/interests`        | Save user interests (requires JWT) | Post-account creation, optional step                    |

---

## Design Decision #1: Rate Limiting Strategy

### The Challenge

Onboarding endpoints are public-facing and attractive targets for malicious actors. Without protection, attackers could:

- Flood our system with fake signups (DDoS)
- Exhaust our SMS credits by requesting thousands of OTPs
- Overwhelm our BVN verification service
- Create fraudulent accounts at scale

### Our Approach: Tiered Rate Limiting

We implemented **different rate limits** for different operations, based on their sensitivity and abuse potential:

- **Sensitive Operations** (5 requests per 5 minutes): `start`, `country`, `bvn`, `send-otp`, `create-account`
  - These are expensive or security-critical
  - Prevents rapid-fire account creation attempts
  - Protects our external service integrations (SMS, BVN verification)

- **Verification Operations** (10 requests per 5 minutes): `verify-otp`, `review`
  - Users might need multiple attempts to enter OTP correctly
  - Slightly more lenient to avoid frustrating legitimate users
  - Still prevents brute-force attacks

**Why This Matters Long-Term:**

As we scale, rate limiting becomes our first line of defense. It's not just about preventing attacks—it ensures fair resource allocation. One malicious actor shouldn't be able to degrade service for thousands of legitimate users. The limits are intentionally conservative now, but they're easily adjustable as we learn more about usage patterns.

---

## Design Decision #2: Step Order & Flow

### Why BVN Before OTP?

The step order (`country` → `bvn` → `send-otp` → `verify-otp`) was primarily driven by **UI/UX considerations**. The frontend application flow guides users through a logical progression:

1. **Country Selection**: Establishes jurisdiction and regulatory requirements
2. **BVN Verification**: Validates identity using government-issued credentials
3. **Phone Verification**: Confirms phone ownership (required for account security)

This order makes sense from a user perspective: you establish who you are (BVN), then prove you control the phone number associated with that identity.

**Technical Flexibility**: While the current implementation follows this order, the session-based architecture means we could reorder steps in the future without major refactoring. The session state tracks progress independently of the step sequence.

---

## Design Decision #3: Session Resumption & Email Updates

### The Problem

Users make typos. They might enter `john@gmial.com` instead of `john@gmail.com`. In a traditional flow, this would mean starting over from scratch, losing all progress.

### Our Solution: Smart Session Resumption

If a user provides an existing `sessionId` but a different email, we **update the email without resetting progress**. This allows users to correct mistakes without losing their verification work.

**Why This Matters:**

- **User Retention**: Reducing friction at every step improves completion rates
- **Support Efficiency**: Support agents can help users fix email typos without forcing a restart
- **Data Integrity**: We preserve verified data (BVN, phone) even when contact information needs correction

**Security Consideration**: The session must still be valid and not expired. We don't allow resuming sessions that are too old, maintaining security while improving UX.

---

## Design Decision #4: Separate Interests Collection

### Why Post-Account Creation?

The `interests` endpoints are intentionally **separate from the core onboarding flow** and require authentication (JWT token). Here's why:

1. **Optional Step**: Interests are for product personalization and analytics, not account security. Making them optional reduces onboarding friction.

2. **User Acquisition Insights**: By collecting interests _after_ account creation, we can analyze what brought users to our platform. Did they come for savings features? Investment products? This data informs marketing and product strategy.

3. **Better Data Quality**: Users are more likely to provide accurate interest data when they're not under pressure to complete account setup.

4. **Future Flexibility**: Interests might evolve into a more complex onboarding step (e.g., risk profiling, product recommendations). Keeping it separate makes it easier to enhance without touching core account creation logic.

**Long-Term Vision**: Interests data could power:

- Personalized product recommendations
- Targeted marketing campaigns
- User segmentation for A/B testing
- Product development prioritization

---

## Design Decision #5: BVN Security & Data Flexibility

### The Security-Flexibility Balance

BVN (Bank Verification Number) is highly sensitive data. If leaked, it could be used for identity theft or fraud. However, BVN verification services return varying data structures, and we need to accommodate different providers and future changes.

### Our Approach: Hash + Flexible Storage

- **BVN Hashing**: The actual BVN is never stored in plain text. We hash it and store only the hash (`bvnHash`). This means even if our database is compromised, attackers can't extract real BVN numbers.

- **JSONB Storage**: Verification data (name, date of birth, phone, etc.) is stored in a flexible JSONB field (`bvnData`). This allows us to:
  - Work with different BVN provider APIs without schema changes
  - Store additional metadata as verification requirements evolve
  - Accommodate varying response formats

**Why This Matters:**

- **Compliance**: We can prove we're not storing sensitive identifiers in plain text
- **Vendor Flexibility**: If we switch BVN providers or add new ones, we don't need database migrations
- **Future-Proofing**: As KYC requirements evolve, we can store additional verification data without structural changes

**Trade-off**: JSONB is less queryable than structured columns, but for verification data that's primarily read (not filtered), this is an acceptable trade-off for flexibility.

---

## Long-Term Considerations & Future-Proofing

### 1. Scalability & Performance

**Current State**: Sessions are stored in PostgreSQL with Redis caching for fast lookups.

**Future Considerations**:

- **Session Cleanup**: Expired sessions need automated cleanup to prevent database bloat. We'll need scheduled jobs to archive or delete old sessions.
- **Read Replicas**: As onboarding volume grows, we may need read replicas to handle review requests without impacting write performance.
- **Caching Strategy**: Redis caching can be expanded to cache BVN verification results across sessions (if the same BVN is verified multiple times).

### 2. Analytics & Business Intelligence

**Current Capability**: Session tracking enables basic analytics (completion rates, drop-off points).

**Future Enhancements**:

- **Funnel Analysis**: Track conversion rates at each step to identify optimization opportunities
- **Cohort Analysis**: Compare onboarding success rates across different user segments (country, referral source, etc.)
- **A/B Testing Infrastructure**: Session-based architecture makes it easy to test different onboarding flows
- **Real-Time Dashboards**: Monitor onboarding health metrics in real-time for operations teams

### 3. Fraud Detection & Security

**Current Protection**: Rate limiting and session tracking provide basic fraud prevention.

**Future Capabilities**:

- **Behavioral Analysis**: Detect suspicious patterns (e.g., same IP creating multiple sessions, rapid-fire verification attempts)
- **Device Fingerprinting**: Track devices across sessions to identify repeat offenders
- **Risk Scoring**: Assign risk scores to sessions based on multiple factors (IP reputation, velocity, data consistency)
- **Integration with Fraud Systems**: Feed session data into external fraud detection services

### 4. Support Tooling Integration

**Current State**: Support agents can look up sessions manually.

**Future Vision**:

- **Support Dashboard**: Real-time view of active onboarding sessions with ability to assist users
- **Automated Outreach**: Trigger emails/SMS to users who abandon onboarding at specific steps
- **Session Replay**: Log user actions (with privacy considerations) to help diagnose issues
- **Bulk Operations**: Support tools to help multiple users complete onboarding (e.g., after a system issue)

### 5. Compliance & Auditability

**Current State**: All actions are logged with timestamps.

**Future Requirements**:

- **Immutable Audit Logs**: Store critical actions (BVN verification, account creation) in append-only logs
- **Regulatory Reporting**: Generate reports for compliance teams showing verification processes
- **Data Retention Policies**: Automated archival of old sessions per regulatory requirements
- **GDPR/Privacy Compliance**: Ability to export or delete user onboarding data on request

### 6. Multi-Channel & International Expansion

**Current Limitation**: Flow is optimized for Nigerian users (BVN verification).

**Future Considerations**:

- **Multi-Country Support**: Different verification methods per country (BVN for Nigeria, NIN for other countries, SSN for US, etc.)
- **Alternative Verification**: Support for document upload, biometric verification, or other methods
- **Localization**: Session data structure supports storing country-specific verification data
- **Currency & Compliance**: Country selection already sets up for multi-currency account creation

### 7. User Experience Enhancements

**Current Flow**: Linear, step-by-step progression.

**Future Possibilities**:

- **Progressive Enhancement**: Save partial progress more frequently (auto-save)
- **Mobile Optimization**: Optimize for mobile-first onboarding (shorter steps, better error handling)
- **Offline Support**: Allow users to complete some steps offline, sync when online
- **Social Proof**: Show completion progress, estimated time remaining

### 8. Integration Points

**Current Integrations**: SMS service, BVN verification, JWT authentication.

**Future Integration Opportunities**:

- **Marketing Automation**: Trigger welcome sequences based on onboarding completion
- **CRM Integration**: Sync onboarding data to customer relationship management systems
- **Product Recommendations**: Use onboarding data to suggest relevant products post-signup
- **Referral Programs**: Track referral sources through onboarding sessions

---

## Error Handling & User Guidance

### The Challenge

When something goes wrong during onboarding, users need clear guidance on what to do next. Generic error messages lead to support tickets and abandoned sessions.

### Our Solution: Context-Aware Errors

Errors include a `screen` field that tells the frontend which step to navigate back to. For example:

- `SESSION_NOT_FOUND` → Navigate to `start` screen
- `OTP_NOT_VERIFIED` → Navigate to `otp` screen
- `EMAIL_TAKEN` → Navigate to `passcode` screen (where they can see the conflict)

This ensures users aren't left confused about where they are in the process.

**Long-Term**: We can enhance error messages with:

- Suggested actions ("Try resending OTP")
- Help documentation links
- Support contact information for complex issues

---

## Conclusion

Every design decision in the onboarding API serves multiple purposes: immediate user needs, security requirements, and long-term operational capabilities. The session-based architecture isn't just a technical choice—it's an investment in our ability to:

- **Understand** our users better
- **Support** them more effectively
- **Protect** our platform from abuse
- **Scale** our operations as we grow
- **Comply** with financial regulations
- **Innovate** with new features and integrations

As we evolve, these foundations will enable us to add capabilities without rebuilding from scratch. The flexibility we've built in (JSONB storage, session resumption, separate interests) means we can adapt to new requirements while maintaining the core user experience that makes onboarding seamless.

---

## Related Documentation

- [API Documentation](/api/docs) - Interactive Swagger documentation
- [Database Schema](/api/peb-fintech_complete_schema.html) - Complete database structure
