# Product Requirements Document: Focus Extension

**Version:** 1.0  
**Date:** January 14, 2026  
**Status:** Draft  
**Product Owner:** TBD

---

## 1. Executive Summary

Focus Extension is a Chrome browser extension designed to help users maintain productivity by intelligently blocking access to distracting websites. Unlike simple blockers, Focus Extension provides flexible controls including dynamic site management, scheduled access windows, and daily time budgets to balance focus with necessary site access.

---

## 2. Problem Statement

Users struggle with maintaining focus while working due to easy access to distracting websites (social media, news, entertainment). Existing solutions are often too rigid (complete blocking) or too lenient (easily bypassed), failing to accommodate legitimate use cases while still protecting focus time.

---

## 3. Goals and Objectives

### Primary Goals
- Reduce time spent on distracting websites during focus periods
- Provide flexible blocking that adapts to user schedules and needs
- Enable conscious decision-making about site access through time budgets

### Success Metrics
- 50% reduction in time spent on blocked sites during focus hours
- 80% user retention after 30 days
- Average 4+ star rating on Chrome Web Store
- Users report 30% improvement in perceived productivity (survey data)

---

## 4. Target Users

### Primary Personas

**1. Remote Worker Rachel**
- Age: 28-35
- Works from home, struggles with social media distractions
- Needs strict blocking during work hours but wants access during breaks
- Values flexibility and control

**2. Student Sam**
- Age: 18-25
- Preparing for exams, easily distracted by YouTube and Reddit
- Needs scheduled study blocks but legitimate research time
- Wants simple setup with minimal configuration

**3. Freelancer Frank**
- Age: 30-45
- Self-employed, managing multiple projects
- Needs different blocking rules for different days/projects
- Requires quick access for client social media management

---

## 5. Core Features

### 5.1 Dynamic Site Management

#### Description
Users can add, remove, and manage blocked websites through an intuitive interface without needing to restart the browser or reinstall the extension.

#### Requirements

**Must Have:**
- Add websites by URL pattern (e.g., `*.twitter.com`, `youtube.com/watch*`)
- Support for domain-level blocking (`facebook.com` blocks all subdomains)
- Support for path-specific blocking (`reddit.com/r/all` but not `reddit.com/r/programming`)
- Remove websites from block list instantly
- Enable/disable individual sites without removing them
- Quick-add from current tab (button to block current site)
- Visual indicator showing when a site is blocked
- Validation to prevent blocking essential sites (settings page, new tab)

**Should Have:**
- Import/export block lists (JSON format)
- Predefined category lists (Social Media, News, Entertainment, Gaming)
- Search/filter functionality for long lists
- Bulk operations (select multiple sites, enable/disable all)
- Site blocking statistics (how often each site was blocked)
- **Exception/allowlist support (allow specific subdomains while blocking parent domain)**

**Could Have:**
- Regex pattern support for advanced users
- Tags/categories for organizing blocked sites
- Suggested sites based on browsing history
- Community-shared block lists

**Won't Have (v1):**
- AI-powered automatic site detection
- Content-based blocking (blocking based on page content)

#### User Stories
- As a user, I can add a website to my block list in under 5 seconds
- As a user, I can temporarily disable blocking for a specific site without removing it
- As a user, I can block all social media with one click using a preset list
- As a user, I can see which sites are currently blocked in my extension popup
- **As a user, I can add exceptions to allow specific subdomains while blocking the main domain (e.g., allow music.youtube.com while blocking youtube.com)**
- **As a content creator, I can block youtube.com but allow studio.youtube.com for channel management**
- **As a developer, I can block reddit.com but allow old.reddit.com or specific subreddits**

#### Exception/Allowlist Feature

**Description:**
The exception system allows users to create allowlists for specific URLs or subdomains while keeping the parent domain blocked. This provides granular control for cases where certain parts of a website are productive or necessary while the main site is distracting.

**Implementation:**
- Each blocked site can have multiple exception patterns
- Exceptions use Chrome's declarativeNetRequest priority system (higher priority = allow rules override block rules)
- Exceptions are more specific than the blocked pattern (e.g., subdomain, path-specific)
- Visual indicator in settings showing number of exceptions per site

**Use Cases:**
- Block `youtube.com` but allow `music.youtube.com` for background music
- Block `reddit.com` but allow `old.reddit.com` or specific work-related subreddits
- Block `twitter.com` but allow `tweetdeck.twitter.com` for social media managers
- Block `github.com/explore` but allow specific repositories

**User Flow:**
1. User blocks a site (e.g., `youtube.com`)
2. User clicks "+ Exception" button on the blocked site entry
3. User enters exception pattern (e.g., `music.youtube.com`)
4. System validates exception is more specific than block pattern
5. Exception is added and displayed as a tag below the site
6. User can remove exceptions by clicking the ✕ on the tag

---

### 5.2 Scheduled Access Windows

#### Description
Users can define time-based schedules that automatically enable or disable website blocking, allowing full access during designated times (lunch breaks, evenings, weekends).

#### Requirements

**Must Have:**
- Create multiple schedule profiles (e.g., "Workday", "Weekend", "Deep Focus")
- Define blocking hours by day of week
- Time-based scheduling with 15-minute granularity
- Active schedule indicator in extension icon
- Override mechanism: "Pause blocking for X minutes"
- Default to "always block" if no schedule is active

**Should Have:**
- Multiple time blocks per day (e.g., block 9-12 and 14-17, allow 12-14 for lunch)
- Quick schedule templates (9-5 workday, evening study, custom)
- Holiday/special day exceptions
- Different block lists for different schedules
- Visual schedule editor (calendar/timeline view)
- Countdown timer showing when blocking period ends

**Could Have:**
- Recurring patterns (block every other day)
- Sunrise/sunset-based scheduling
- Integration with calendar apps (block during meetings)
- Smart scheduling based on browsing patterns

**Won't Have (v1):**
- Location-based scheduling (block only when at home)
- Automatic schedule learning via AI

#### User Stories
- As a remote worker, I can set blocking to activate 9am-5pm on weekdays only
- As a student, I can create a "Study Block" schedule for exam weeks
- As a user, I can quickly pause blocking for 15 minutes when I need quick access
- As a user, I can see at a glance whether blocking is currently active
- As a freelancer, I can have different schedules for different clients/projects

---

### 5.3 Daily Time Budget

#### Description
When users navigate to a blocked site, they can access it using a limited daily time budget. This provides controlled access for legitimate needs while preventing extended distraction sessions.

#### Requirements

**Must Have:**
- Configurable daily budget per site (5-60 minutes, 5-minute increments)
- Configurable global budget for all blocked sites (10-120 minutes)
- Real-time countdown display when accessing blocked site
- Warning notifications at 50%, 75%, 90% of budget consumed
- Complete block when budget exhausted
- Budget reset at configurable time (default: midnight local time)
- Interstitial page before accessing blocked site showing:
  - Remaining budget for this site
  - Remaining global budget
  - Options: "Continue (use budget)" or "Go back"
  - Motivational message/quote

**Should Have:**
- Per-site budget customization (different budgets for different sites)
- Budget history/analytics (how budget was used over time)
- Visual progress bar showing remaining budget
- "Budget rollover" option (unused budget adds to next day, max 2x)
- "Emergency access" that costs extra budget (2x time)
- Ability to reset budget early with confirmation dialog
- Weekly/monthly budget summaries

**Could Have:**
- Earn extra budget through focused work time
- Budget banking (save budget for specific days)
- Share budget across devices (sync)
- Gamification: streaks for staying under budget
- Social accountability (share budget goals with friends)

**Won't Have (v1):**
- Payment for additional budget (monetization)
- Parent/employer-controlled budgets

#### User Stories
- As a user, I see a clear warning before spending my time budget
- As a user, I can check my remaining budget without visiting a blocked site
- As a user, I receive a notification when my budget is running low
- As a user, I cannot access blocked sites once my budget is exhausted
- As a user, my budget resets each morning so I have a fresh start
- As a social media manager, I can allocate more budget to work-related sites

---

## 6. User Interface & Experience

### 6.1 Extension Popup
**Accessed by:** Clicking extension icon in toolbar

**Contents:**
- Status indicator (Blocking Active/Paused/Off)
- Quick controls:
  - Pause blocking (15min, 30min, 1hr, custom)
  - Add current site to block list
- Summary stats:
  - Sites blocked today
  - Time budget remaining (global)
  - Current schedule
- Quick links:
  - Settings
  - View blocked sites
  - Statistics

**Design Notes:**
- Clean, minimal interface
- Maximum 2 clicks to common actions
- Clear visual hierarchy
- Accessible (WCAG 2.1 AA compliant)

### 6.2 Interstitial Block Page
**Appears when:** User navigates to blocked site

**Contents:**
- Clear message: "This site is blocked to help you focus"
- Blocked site URL
- Time budget information:
  - Budget remaining for this site
  - Global budget remaining
- Options:
  - "Use time budget and continue" (primary button)
  - "Go back" (secondary button)
  - "Remove from block list" (text link)
- Motivational quote or productivity tip
- Current time and date

**Design Notes:**
- Cannot be closed or bypassed without making a choice
- 5-second delay before "Continue" button becomes active (friction)
- Calm, professional design (not punishing)
- Option to disable motivational quotes in settings

### 6.3 Options/Settings Page
**Accessed by:** Right-click extension icon → Options, or link from popup

**Sections:**

1. **Blocked Sites**
   - List view with search/filter
   - Add/remove sites
   - Import/export lists
   - Quick-add categories

2. **Schedules**
   - Create/edit/delete schedules
   - Visual schedule builder
   - Set active schedule

3. **Time Budgets**
   - Global budget setting
   - Per-site budget overrides
   - Budget reset time
   - Budget history graph

4. **General Settings**
   - Extension enable/disable
   - Notifications preferences
   - Theme (light/dark)
   - Data export

5. **Statistics**
   - Sites blocked over time
   - Budget usage trends
   - Focus time achieved
   - Productivity insights

**Design Notes:**
- Tabbed interface for organization
- Immediate save (no "Save" button needed)
- Export all settings for backup
- Clear, helpful tooltips

---

## 7. Technical Requirements

### 7.1 Technology Stack
- **Framework:** Manifest V3 Chrome Extension
- **Languages:** JavaScript (ES6+), HTML5, CSS3
- **Storage:** Chrome Storage API (sync enabled)
- **Libraries:**
  - Chart.js (for statistics visualization)
  - Day.js (for time/date manipulation)
  - Optional: React (if UI complexity warrants)

### 7.2 Permissions Required
- `tabs` - Monitor tab URLs and intercept navigation
- `storage` - Save settings and preferences
- `alarms` - Schedule budget resets and notifications
- `declarativeNetRequest` - Block site requests efficiently
- `notifications` - Budget warnings and reminders
- `activeTab` - Quick-add current site feature

### 7.3 Performance Requirements
- Extension overhead: < 5MB memory footprint
- Page load impact: < 50ms additional delay
- Settings sync time: < 2 seconds
- Interstitial page display: < 100ms after URL match

### 7.4 Data Storage
- **Local Storage:**
  - Block list (up to 500 sites)
  - Schedule configurations (up to 10 schedules)
  - Time budget data (30 days of history)
  - Statistics and analytics data
  
- **Sync Storage:**
  - User preferences
  - Active schedule
  - Block list (synced across devices)
  - Budget settings

**Size Constraints:**
- Chrome Sync Storage limit: 100KB
- Use compression for large block lists

### 7.5 Browser Compatibility
- **Minimum Chrome Version:** 110 (Manifest V3 stable support)
- **Target Browsers:**
  - Chrome (primary)
  - Edge (Chromium) (secondary)
  - Brave (secondary)
- **Not Supporting:** Firefox (different extension API), Safari

---

## 8. Security & Privacy

### 8.1 Privacy Principles
- **No external data transmission** - all data stays local/sync storage
- **No tracking or analytics** - we don't collect usage data
- **No account required** - fully local functionality
- **Transparent permissions** - clear explanation of why each permission is needed

### 8.2 Data Handling
- All user data encrypted in Chrome Sync Storage (handled by Chrome)
- No server-side storage or processing
- Export function provides unencrypted JSON for user backup
- No access to page content, only URLs
- No keystroke logging or form monitoring

### 8.3 Security Considerations
- Validate all URL patterns to prevent XSS
- Sanitize user input in settings
- Use Content Security Policy in extension pages
- Regular security audits before releases
- Prompt permission review if new permissions needed

---

## 9. User Onboarding

### 9.1 First-Time Experience
1. **Welcome Screen:**
   - Brief introduction (3-4 sentences)
   - Value proposition
   - Privacy commitment

2. **Quick Setup Wizard (Optional):**
   - "What's distracting you?" - Add 3-5 sites
   - "When do you need focus?" - Choose schedule template
   - "How much access do you need?" - Set time budget
   - Complete setup

3. **Tutorial Highlights:**
   - How to add sites (highlight extension icon)
   - How to pause blocking
   - Where to find settings

### 9.2 Help & Documentation
- In-app tooltips on first use
- Link to documentation site
- FAQ section in settings
- Video tutorial (external link)
- Contact/feedback form

---

## 10. Future Considerations (Post-v1)

### Phase 2 Features
- **Sync across browsers** - Cross-browser sync service
- **Mobile companion** - Block sites on mobile browsers
- **Advanced analytics** - Detailed productivity reports
- **Team/family plans** - Shared block lists and accountability
- **Integration with productivity tools** - Todoist, Notion, etc.
- **Focus sessions** - Pomodoro-style work sessions with blocking

### Phase 3 Features
- **AI-powered insights** - Automatic distraction detection
- **Browser history analysis** - Suggest sites to block
- **Wellness features** - Break reminders, eye strain prevention
- **API for developers** - Allow other apps to trigger focus mode
- **Premium tier** - Advanced features for power users

---

## 11. Success Criteria

### Launch Criteria (v1.0)
- [ ] All core features implemented and tested
- [ ] Security audit passed
- [ ] Privacy policy published
- [ ] Chrome Web Store listing approved
- [ ] Documentation site live
- [ ] Support email configured

### Post-Launch Metrics (30 days)
- **Adoption:**
  - 1,000+ active users
  - 4.0+ average rating
  - <5% uninstall rate

- **Engagement:**
  - 70%+ of users add at least 3 sites
  - 50%+ of users create a schedule
  - 60%+ of users stay within time budget

- **Performance:**
  - <0.1% crash rate
  - <1% bug report rate
  - Average support response time <24 hours

---

## 12. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Users find workarounds | High | Medium | Make bypassing require conscious effort, not technical blocks |
| Chrome Manifest V3 API limitations | High | Medium | Thoroughly test API capabilities early; have backup approaches |
| Performance issues with large block lists | Medium | Low | Implement efficient URL matching algorithms; set list limits |
| User privacy concerns | High | Low | Clear privacy policy; no data collection; open communication |
| Competition from established extensions | Medium | High | Focus on unique value prop (time budgets); superior UX |
| Browser API changes | Medium | Low | Monitor Chrome extension updates; maintain compatibility layer |

---

## 13. Dependencies & Assumptions

### Dependencies
- Chrome Web Store review process (~1-2 weeks)
- Chrome Extension APIs remain stable
- User motivation to maintain focus (product facilitates, doesn't force)

### Assumptions
- Users have Chrome version 110+
- Users understand basic extension concepts
- Users want help with focus (not forced by employer/parent)
- Users will configure extension for their needs

---

## 14. Open Questions

1. Should we allow password-protected settings to prevent self-sabotage?
2. What's the optimal default time budget to suggest?
3. Should blocked site data be visible to help users understand their habits?
4. How aggressive should the friction be (delay, warnings) on the interstitial page?
5. Should we support incognito mode blocking (requires special permission)?

---

## 15. Appendix

### A. Competitive Analysis
- **StayFocusd** - Popular but outdated, limited flexibility
- **Freedom** - Cross-platform but subscription-based
- **Cold Turkey** - Very strict, Windows only
- **LeechBlock** - Firefox-focused, complex UI
- **BlockSite** - Simple but lacks scheduling depth

**Our Differentiation:**
- Time budgets (unique approach)
- Superior scheduling flexibility
- Modern, intuitive UI
- Completely free, no data collection
- Balance between strictness and flexibility

### B. Technical Debt Considerations
- Plan for Manifest V4 migration path
- Modular architecture for feature toggles
- Comprehensive test coverage from start
- Documentation as code evolves

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-14 | Initial | Initial PRD creation |

