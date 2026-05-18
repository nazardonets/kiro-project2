# Requirements Document

## Introduction

Know Your Woman Cycle is a web application designed to help a male partner better understand and support a woman throughout her menstrual cycle. The application analyzes cycle phases and provides practical, actionable suggestions to improve relationship quality, communication, and emotional awareness. The system uses a paired account model where the woman initiates the account, retains full data control, and shares cycle insights with her partner through a shared dashboard.

## Glossary

- **System**: The Know Your Woman Cycle web application
- **Primary_User**: The woman who creates the account, inputs cycle data, and controls sharing permissions
- **Partner_User**: The male partner who receives insights and guidance based on shared cycle data
- **Cycle_Phase**: One of five distinct periods within a menstrual cycle (Menstrual, Follicular, Ovulation, Early Luteal, Late Luteal)
- **Menstrual_Phase**: Days 1–5 of the cycle, characterized by withdrawal, reflection, and low energy
- **Follicular_Phase**: Days 6–13 of the cycle, characterized by renewal, curiosity, and new beginnings
- **Ovulation_Phase**: Around Day 14 of the cycle, characterized by connection, confidence, and outward energy
- **Early_Luteal_Phase**: Days 15–21 of the cycle, characterized by focus and productivity
- **Late_Luteal_Phase**: Days 22–28 of the cycle (PMS period), characterized by sensitivity and emotional intensity
- **Cycle_Data**: The start date of the menstrual cycle and any historical cycle records
- **Insights_Dashboard**: The shared view displaying current phase, emotional tendencies, energy levels, and behavioral patterns
- **Primary_Dashboard**: The personalized view for the Primary_User showing current phase, predictions, tendencies, and wellbeing insights
- **Guidance_Panel**: The section providing actionable recommendations to the Partner_User
- **Phase_Prediction**: The calculated forecast of upcoming cycle phases based on historical Cycle_Data
- **Secure_Invite**: A unique, time-limited link or email used by the Primary_User to invite the Partner_User
- **Daily_Summary**: A short daily overview including current state, best approach, and behaviors to avoid
- **Email_Notification**: An automated email sent to the Partner_User containing cycle phase summary, insights, and recommendations
- **Notification_Frequency**: The configurable schedule for email delivery (daily, phase-based only, or custom timing)
- **Date_Request**: A structured invitation initiated by the Primary_User to request quality time with the Partner_User
- **Insight_Category**: A groupable type of shared content (emotional tendencies, behavioral patterns, energy levels, communication guidance) that the Primary_User can individually enable or disable for sharing
- **Admin_User**: A privileged user with access to the Admin_Panel for managing accounts, cycle data, and system content
- **Admin_Panel**: A secure, restricted interface for Admin_Users to manage user accounts, cycle instances, and system-generated content
- **Cycle_Instance**: An individual record representing one complete menstrual cycle for a specific Primary_User, containing the start date, phase data, and any associated administrative annotations
- **Admin_Annotation**: Additional context, curated guidance, or overridden recommendations added by an Admin_User to a specific Cycle_Instance or Cycle_Phase without altering the original user-provided data
- **Onboarding_Survey**: A set of six profile questions presented to the Primary_User during account creation that captures self-described cycle patterns, emotional sensitivity, social energy preferences, conflict triggers, preferred support styles, and communication boundaries to personalize Partner_User guidance
- **Survey_Response**: An individual answer provided by the Primary_User to one of the six Onboarding_Survey questions, stored as part of the Primary_User's profile

---

## Requirements

### Requirement 1: Account Creation

**User Story:** As a woman, I want to create a primary account and invite my partner, so that we can share cycle insights within a controlled environment.

#### Acceptance Criteria

1. THE System SHALL allow the Primary_User to create an account using a valid email address and a password that is between 8 and 128 characters long and contains at least one uppercase letter, one lowercase letter, and one digit
2. WHEN the Primary_User requests a partner invitation, THE System SHALL generate a Secure_Invite containing a unique token valid for 72 hours
3. WHEN the Partner_User activates a valid Secure_Invite, THE System SHALL require the Partner_User to provide an email address and password meeting the same requirements as Primary_User account creation, and create a linked Partner_User account associated with the Primary_User account
4. IF a Secure_Invite has expired, THEN THE System SHALL display a message indicating the invitation is no longer valid and prompt the Primary_User to generate a new one
5. THE System SHALL restrict each Primary_User account to one linked Partner_User account at a time
6. IF the Primary_User or Partner_User attempts to create an account with an email address already associated with an existing account, THEN THE System SHALL reject the registration and display a message indicating the email is already in use
7. IF the Primary_User submits a password that does not meet the minimum requirements during account creation, THEN THE System SHALL reject the submission and display a message indicating which password requirements are not satisfied

### Requirement 2: Data Privacy and Access Control

**User Story:** As a woman, I want full control over my cycle data and sharing permissions, so that I feel safe and respected while using the application.

#### Acceptance Criteria

1. THE System SHALL grant the Primary_User exclusive permission to input, edit, and delete Cycle_Data
2. IF the Partner_User attempts to modify any Cycle_Data, THEN THE System SHALL block the action and display a message indicating that only the Primary_User can modify Cycle_Data
3. WHEN the Primary_User revokes sharing permissions, THE System SHALL remove the Partner_User's access to the Insights_Dashboard and Guidance_Panel within 5 seconds of the revocation action
4. WHEN the Primary_User initiates account deletion, THE System SHALL require an explicit confirmation step before permanently deleting the account and all associated Cycle_Data
5. WHEN the Primary_User confirms account deletion, THE System SHALL delete the Primary_User account, all associated Cycle_Data, and deactivate the linked Partner_User account
6. WHEN the Primary_User unlinks the Partner_User, THE System SHALL remove all Partner_User access without deleting the Primary_User account or Cycle_Data

### Requirement 3: Granular Sharing Controls

**User Story:** As a woman, I want to manage exactly what categories of insights and notifications are shared with my partner, so that I maintain control over how my data is presented.

#### Acceptance Criteria

1. THE System SHALL allow the Primary_User to enable or disable sharing for each Insight_Category independently, with all categories enabled by default upon initial partner linking
2. WHEN the Primary_User disables an Insight_Category, THE System SHALL remove that category from the Partner_User's Insights_Dashboard and Guidance_Panel, and WHEN the Primary_User re-enables an Insight_Category, THE System SHALL restore that category's content on the Partner_User's Insights_Dashboard and Guidance_Panel
3. THE System SHALL allow the Primary_User to enable or disable specific notification types sent to the Partner_User (daily summaries, phase alerts, partner reminders), with all notification types enabled by default upon initial partner linking
4. WHEN the Primary_User modifies sharing preferences, THE System SHALL apply the changes within 5 seconds without requiring the Partner_User to refresh
5. IF all Insight_Categories are disabled by the Primary_User, THEN THE System SHALL display a message on the Partner_User's Insights_Dashboard indicating that no shared content is currently available

### Requirement 4: Modern and Responsive User Interface

**User Story:** As a user, I want the application to have a modern, visually appealing interface that works seamlessly on mobile devices, so that I can access cycle insights and guidance from any device.

#### Acceptance Criteria

1. THE System SHALL render all pages using a consistent design system with a base font size no smaller than 16px, a minimum body line-height of 1.5, uniform spacing increments, and a defined color palette applied across all views
2. THE System SHALL implement a fully responsive layout that adapts to screen widths from 320px to 2560px without horizontal scrolling or content overflow
3. WHEN accessed on a mobile device with a screen width below 768px, THE System SHALL display a mobile-optimized layout with touch-friendly controls (minimum tap target size of 44x44 pixels)
4. THE System SHALL ensure all interactive elements (buttons, date pickers, toggles, navigation) are operable via touch and keyboard without requiring hover interactions, conforming to WCAG 2.1 Level AA success criteria for operability
5. THE System SHALL load the initial page content within 3 seconds on a simulated 4G connection (9 Mbps download, 1.5 Mbps upload, 170ms round-trip latency)
6. THE System SHALL maintain identical feature availability and correct layout rendering across the latest two major versions of Chrome, Safari, Firefox, and Edge browsers with no functionality loss or layout breakage
7. WHILE displayed on screens below 768px width, THE System SHALL use a mobile-first navigation pattern (bottom navigation bar or hamburger menu)
8. THE System SHALL render body text at a minimum size of 16px on viewports below 768px and a minimum size of 14px on viewports at or above 768px to ensure readability across devices

### Requirement 5: Admin User Management

**User Story:** As an admin, I want full access to a secure admin panel where I can manage user accounts, so that I can oversee platform operations and resolve account issues.

#### Acceptance Criteria

1. THE Admin_Panel SHALL require Admin_User authentication before granting access
2. THE Admin_Panel SHALL allow the Admin_User to search for user accounts by email address or account identifier and display a maximum of 50 matching results per query
3. THE Admin_Panel SHALL allow the Admin_User to view account details for any Primary_User or Partner_User including account status, creation date, and partner link status
4. THE Admin_Panel SHALL allow the Admin_User to suspend a Primary_User or Partner_User account with a recorded reason between 1 and 500 characters in length
5. WHEN the Admin_User initiates account deletion, THE Admin_Panel SHALL require the Admin_User to confirm the action before permanently removing the user account and all associated data
6. THE Admin_Panel SHALL allow the Admin_User to view partner link relationships and to manually link or unlink Primary_User and Partner_User accounts
7. WHEN an Admin_User suspends an account, THE System SHALL revoke access for the suspended user within 30 seconds and notify the affected user via email
8. WHEN an Admin_User deletes a Primary_User account, THE System SHALL remove the linked Partner_User's access to all shared Cycle_Data and Insights_Dashboard content
9. IF an Admin_User suspends a Primary_User account that has a linked Partner_User, THEN THE System SHALL also revoke the Partner_User's access to the Insights_Dashboard and Guidance_Panel

### Requirement 6: Admin Cycle Instance Management

**User Story:** As an admin, I want to view and enrich individual cycle instances with additional context and curated guidance, so that I can supplement system-generated recommendations without altering user-provided data.

#### Acceptance Criteria

1. THE Admin_Panel SHALL display all Cycle_Instances for a selected Primary_User including historical and current records, ordered by start date from most recent to oldest
2. THE Admin_Panel SHALL allow the Admin_User to view the details of any Cycle_Instance including start date, calculated phases, and associated Phase_Predictions
3. THE Admin_Panel SHALL allow the Admin_User to add an Admin_Annotation of between 1 and 2000 characters to a specific Cycle_Instance or Cycle_Phase
4. WHEN an Admin_Annotation exists for a Cycle_Instance, THE System SHALL display the annotation alongside system-generated content without replacing the original recommendations
5. THE Admin_Panel SHALL allow the Admin_User to override system-generated recommendations with replacement text of between 1 and 2000 characters for a specific Cycle_Phase within a Cycle_Instance
6. WHEN an Admin_User overrides a recommendation, THE System SHALL display the overridden content in place of the default system-generated content for that Cycle_Phase and indicate that the content has been overridden by an admin
7. THE System SHALL preserve the original user-provided Cycle_Data unmodified regardless of any Admin_Annotations or overrides applied
8. THE Admin_Panel SHALL allow the Admin_User to edit or delete any existing Admin_Annotation associated with a Cycle_Instance or Cycle_Phase
9. THE Admin_Panel SHALL allow the Admin_User to revert an overridden recommendation to restore the original system-generated content for that Cycle_Phase

### Requirement 7: Cycle Data Input

**User Story:** As a woman, I want to input the start date of my menstrual cycle, so that the system can calculate my current phase and predict future phases.

#### Acceptance Criteria

1. THE System SHALL provide the Primary_User with a date picker to input the start date of the current menstrual cycle, with selectable dates ranging from 365 days in the past up to and including today
2. WHEN the Primary_User submits a cycle start date, THE System SHALL store the date as a new cycle record in the Cycle_Data and display a confirmation message indicating the record was saved successfully
3. THE System SHALL allow the Primary_User to input up to 12 historical cycle start dates within the past 365 days to improve Phase_Prediction accuracy
4. IF the Primary_User submits a start date in the future, THEN THE System SHALL reject the input and display a validation message indicating the date must be today or earlier
5. IF the Primary_User submits a start date that falls within the cycle duration (based on the average cycle length derived from existing Cycle_Data, or 28 days if fewer than two records exist) of an existing cycle record's start date, THEN THE System SHALL display a conflict warning identifying the overlapping record and prompt the Primary_User to confirm or correct the entry

### Requirement 8: Phase Calculation and Prediction

**User Story:** As a user, I want the system to automatically determine the current cycle phase and predict upcoming phases, so that I can plan and prepare accordingly.

#### Acceptance Criteria

1. WHEN the Primary_User submits a cycle start date, THE System SHALL calculate the current Cycle_Phase based on the number of days elapsed since the start date using the standard phase durations (Menstrual: Days 1–5, Follicular: Days 6–13, Ovulation: Day 14, Early Luteal: Days 15–21, Late Luteal: Days 22–28)
2. WHEN at least two historical cycle records exist, THE System SHALL calculate the average cycle length and proportionally scale each phase duration relative to the 28-day default to adjust Phase_Prediction boundaries
3. WHEN midnight occurs in the Primary_User's local timezone, THE System SHALL recalculate the current Cycle_Phase based on the updated number of days elapsed
4. THE System SHALL generate Phase_Prediction for the next 60 days based on available Cycle_Data, using the standard 28-day phase durations when fewer than two historical cycle records exist
5. WHEN a new cycle start date is submitted, THE System SHALL recalculate the current Cycle_Phase and update all Phase_Predictions within 5 seconds
6. IF the number of days elapsed since the most recent cycle start date exceeds 28 days (or the calculated average cycle length when available), THEN THE System SHALL continue displaying Late_Luteal_Phase and indicate the cycle is overdue

### Requirement 9: Customization Based on Individual Patterns

**User Story:** As a woman, I want to customize insights based on my individual patterns, so that the guidance reflects my actual experience rather than generic averages.

#### Acceptance Criteria

1. THE System SHALL allow the Primary_User to adjust the default duration of each Cycle_Phase to match individual patterns, with each phase duration configurable between 1 and 14 days
2. WHEN the Primary_User customizes phase durations, THE System SHALL use the customized durations for Phase_Prediction and phase calculations only after validating that the sum of all phase durations equals the Primary_User's total cycle length
3. IF the Primary_User submits customized phase durations that do not sum to the total cycle length, THEN THE System SHALL reject the input and display a validation message indicating the required total
4. THE System SHALL allow the Primary_User to add personal notes about emotional or behavioral patterns for each Cycle_Phase, with each note limited to 500 characters
5. WHEN personal notes exist for a Cycle_Phase and the corresponding Insight_Category sharing is enabled, THE System SHALL display the personal notes as a distinct labeled section within the Insights_Dashboard and Guidance_Panel content shown to the Partner_User

### Requirement 10: Primary User Personal Dashboard

**User Story:** As a woman, I want a personalized dashboard showing my current phase, predictions, and wellbeing insights, so that I can track my own cycle and understand my patterns.

#### Acceptance Criteria

1. THE System SHALL display the current Cycle_Phase name and the current day number within that phase on the Primary_Dashboard
2. THE System SHALL display predicted upcoming phases for the next 60 days on the Primary_Dashboard based on available Cycle_Data
3. THE System SHALL display emotional, cognitive, and behavioral tendencies for the current Cycle_Phase on the Primary_Dashboard
4. THE System SHALL display self-care suggestions and energy management insights specific to the current Cycle_Phase on the Primary_Dashboard
5. WHEN the Cycle_Phase changes, THE System SHALL update all Primary_Dashboard content to reflect the new phase within 60 seconds
6. IF no Cycle_Data exists for the Primary_User, THEN THE System SHALL display the Primary_Dashboard in an empty state with a prompt directing the Primary_User to input a cycle start date

### Requirement 11: Date Request Feature

**User Story:** As a woman, I want to initiate a date request through the app that sends a structured notification to my partner, so that I can express my desire for quality time in a clear and low-friction way.

#### Acceptance Criteria

1. THE System SHALL provide the Primary_User with a "Request a Date" action on the Primary_Dashboard
2. WHEN the Primary_User initiates a Date_Request, THE System SHALL allow the Primary_User to optionally specify a preferred location (restaurant, outdoor activity, home setting, or custom text up to 200 characters)
3. WHEN the Primary_User initiates a Date_Request, THE System SHALL allow the Primary_User to optionally specify a desired mood or vibe (relaxed evening, romantic, fun, low-energy, or custom text up to 200 characters)
4. WHEN the Primary_User initiates a Date_Request, THE System SHALL allow the Primary_User to optionally specify timing preferences as either a specific date or a flexible window defined by a start date and end date
5. WHEN the Primary_User initiates a Date_Request, THE System SHALL allow the Primary_User to optionally include personal notes or intentions up to 500 characters
6. WHEN the Primary_User submits a Date_Request, THE System SHALL send a structured email notification to the Partner_User containing all specified details
7. THE System SHALL format the Date_Request email with labeled sections for each specified detail (location, mood, timing, and personal notes) and include a phase-context section describing the Primary_User's current Cycle_Phase tendencies and suggested activity alignment
8. THE System SHALL present the Date_Request email using the tone and language guidelines defined in Requirement 19 (probabilistic framing, partnership-focused, non-deterministic)
9. IF the Primary_User submits a Date_Request and no Partner_User is linked or sharing permissions are revoked, THEN THE System SHALL display a message indicating the request cannot be sent and retain the entered details for resubmission
10. IF the Date_Request email fails to deliver, THEN THE System SHALL notify the Primary_User that the request was not sent and allow the Primary_User to retry submission

### Requirement 12: Shared Insights Dashboard

**User Story:** As a partner, I want to see a real-time view of the current cycle phase and associated tendencies, so that I can better understand my partner's current state.

#### Acceptance Criteria

1. WHILE the Partner_User has active sharing permissions, THE System SHALL display the current Cycle_Phase on the Insights_Dashboard
2. WHILE the Partner_User has active sharing permissions, THE System SHALL display the emotional tendencies associated with the current Cycle_Phase
3. WHILE the Partner_User has active sharing permissions, THE System SHALL display the expected energy levels for the current Cycle_Phase
4. WHILE the Partner_User has active sharing permissions, THE System SHALL display the behavioral patterns and social preferences for the current Cycle_Phase
5. THE System SHALL present all insights using language that frames them as tendencies and probabilities rather than deterministic predictions
6. WHEN the Cycle_Phase changes, THE System SHALL update the Insights_Dashboard content to reflect the new phase within 60 seconds of the phase transition
7. IF the Partner_User accesses the Insights_Dashboard and no Cycle_Data has been submitted by the Primary_User, THEN THE System SHALL display a message indicating that cycle data is not yet available

### Requirement 13: Phase-Based Insights Content

**User Story:** As a partner, I want to understand the emotional, behavioral, and energy characteristics of each cycle phase, so that I can be more empathetic and supportive.

#### Acceptance Criteria

1. THE System SHALL provide an emotional state overview for each of the five Cycle_Phases, containing at least three descriptive tendencies per phase
2. THE System SHALL provide typical thought pattern descriptions for each of the five Cycle_Phases, containing at least two cognitive tendencies per phase
3. THE System SHALL provide behavioral tendency descriptions for each of the five Cycle_Phases, containing at least two behavioral tendencies per phase
4. THE System SHALL provide an energy level indicator for each of the five Cycle_Phases using a labeled scale (e.g., Low, Moderate, High) with a brief descriptive summary of no more than two sentences
5. THE System SHALL provide communication style descriptions for each of the five Cycle_Phases, containing at least two communication tendencies per phase
6. THE System SHALL use language that emphasizes variability and individuality in all phase descriptions by using probabilistic framing such as "may experience" or "common tendencies include" rather than deterministic statements
7. THE System SHALL present all phase-based insights content in a consistent structure across all five Cycle_Phases, using the same set of content categories (emotional state, thought patterns, behavioral tendencies, energy level, communication style) for each phase
8. WHILE the Primary_User has personal notes for a Cycle_Phase, THE System SHALL display the personal notes alongside the system-generated phase insights content

### Requirement 14: Contextual Guidance for Partner

**User Story:** As a partner, I want clear, actionable advice on how to communicate and behave during each phase, so that I can support my partner effectively.

#### Acceptance Criteria

1. WHILE the current Cycle_Phase is active, THE Guidance_Panel SHALL display 3 to 5 recommended supportive actions for the Partner_User, specific to the current Cycle_Phase
2. WHILE the current Cycle_Phase is active, THE Guidance_Panel SHALL display 2 to 4 common triggers or mistakes to avoid, specific to the current Cycle_Phase
3. WHILE the current Cycle_Phase is active, THE Guidance_Panel SHALL display 2 to 4 communication strategies including recommended tone and language examples, specific to the current Cycle_Phase
4. WHILE the current Cycle_Phase is active, THE Guidance_Panel SHALL display 2 to 4 discouraged language or tone patterns, specific to the current Cycle_Phase
5. THE System SHALL present all guidance using probabilistic framing and suggestion-oriented language, avoiding imperative commands, deterministic statements, and stereotyping language
6. THE System SHALL frame all recommendations as suggestions rather than directives, using phrasing such as "consider" or "you might try" instead of "you must" or "always do"
7. WHEN the Cycle_Phase changes, THE System SHALL update the Guidance_Panel content to reflect the new phase's recommendations
8. WHILE the Partner_User has active sharing permissions for the communication guidance Insight_Category, THE Guidance_Panel SHALL be accessible to the Partner_User
9. IF the Partner_User does not have active sharing permissions for the communication guidance Insight_Category, THEN THE System SHALL hide the Guidance_Panel from the Partner_User

### Requirement 15: Daily Summary

**User Story:** As a partner, I want a short daily summary of the current state and best approach, so that I can quickly understand how to be supportive today.

#### Acceptance Criteria

1. THE System SHALL generate a Daily_Summary containing a "Today's State" section that states the current Cycle_Phase name and lists the associated emotional tendencies and energy level in no more than 3 sentences
2. THE System SHALL generate a Daily_Summary containing a "Best Approach" section with one to three recommended supportive behaviors specific to the current Cycle_Phase
3. THE System SHALL generate a Daily_Summary containing an "Avoid This" section with one to three behaviors to avoid specific to the current Cycle_Phase
4. THE System SHALL regenerate the Daily_Summary once per day at midnight in the Primary_User's local timezone
5. WHEN the Cycle_Phase changes, THE System SHALL update the Daily_Summary content to reflect the new phase within the same regeneration cycle
6. WHEN the Partner_User logs in or accesses the Insights_Dashboard, THE System SHALL display the Daily_Summary as the first content section visible without scrolling
7. WHILE the Primary_User has revoked sharing permissions, THE System SHALL not display the Daily_Summary to the Partner_User

### Requirement 16: Decision Support Layer

**User Story:** As a partner, I want cycle data translated into clear behavioral recommendations, so that I can quickly understand what actions to take.

#### Acceptance Criteria

1. WHILE the Partner_User has active sharing permissions, THE System SHALL display between 3 and 5 behavioral prompts derived from the current Cycle_Phase data on the Guidance_Panel
2. THE System SHALL limit each behavioral prompt to a maximum of two sentences and a maximum of 280 characters
3. WHERE scenario-based advice is enabled, THE System SHALL provide between 2 and 4 situational recommendations per Cycle_Phase, each addressing a specific relationship scenario (such as planning an evening together, handling a disagreement, or initiating conversation)
4. WHEN the Cycle_Phase changes, THE System SHALL update all behavioral prompts and situational recommendations to reflect the new phase
5. IF the Primary_User has revoked sharing permissions, THEN THE System SHALL hide all behavioral prompts and situational recommendations from the Partner_User

### Requirement 17: Partner Email Notification System

**User Story:** As a partner, I want to receive automated email summaries with cycle insights and recommendations, so that I stay informed and can act supportively without needing to check the app constantly.

#### Acceptance Criteria

1. WHEN an Email_Notification is triggered, THE System SHALL include the current Cycle_Phase name and a phase summary of no more than 3 sentences in the email body
2. WHEN an Email_Notification is triggered, THE System SHALL include 1 to 3 emotional and behavioral insights for the current phase in the email body
3. WHEN an Email_Notification is triggered, THE System SHALL include 1 to 3 "Do" recommendations and 1 to 3 "Don't" recommendations in the email body
4. WHEN an Email_Notification is triggered, THE System SHALL include interaction guidance of no more than 2 sentences for the current phase in the email body
5. THE System SHALL allow the Partner_User to configure Notification_Frequency as one of: daily reminders, phase-based alerts only, or custom timing (morning digest delivered between 6:00–9:00 AM or evening digest delivered between 6:00–9:00 PM in the Partner_User's local timezone)
6. WHEN Notification_Frequency is set to daily, THE System SHALL send one Email_Notification per day at the Partner_User's configured delivery time in the Partner_User's local timezone
7. WHEN Notification_Frequency is set to phase-based, THE System SHALL send an Email_Notification only when the Cycle_Phase transitions to a new phase
8. THE System SHALL allow the Primary_User to enable or disable Email_Notifications sent to the Partner_User at any time
9. WHEN the Primary_User disables Email_Notifications, THE System SHALL stop sending all Email_Notifications to the Partner_User within 60 seconds and preserve the Partner_User's Notification_Frequency configuration for future re-enablement
10. THE System SHALL default Notification_Frequency to daily reminders with morning delivery until the Partner_User configures a preference
11. IF an Email_Notification fails to deliver, THEN THE System SHALL retry delivery up to 3 times with 5-minute intervals, and if all retries fail, THE System SHALL display an undelivered notification indicator on the Partner_User's Insights_Dashboard

### Requirement 18: Partner Reminders

**User Story:** As a partner, I want to receive contextual reminders such as date suggestions, so that I can take proactive supportive actions.

#### Acceptance Criteria

1. WHILE the current Cycle_Phase indicates high social energy (Ovulation_Phase or Follicular_Phase), THE System SHALL deliver a reminder to the Partner_User via email containing 1 to 3 date or social activity suggestions relevant to the current Cycle_Phase
2. THE System SHALL allow the Partner_User to enable or disable reminder notifications, with reminders disabled by default until the Partner_User explicitly enables them
3. THE System SHALL deliver reminders at a configurable time of day chosen by the Partner_User, defaulting to 9:00 AM in the Partner_User's local timezone if no preference is set
4. THE System SHALL limit reminders to a maximum of one per day to avoid notification fatigue
5. IF the current Cycle_Phase is not Ovulation_Phase or Follicular_Phase, THEN THE System SHALL not send any partner reminders to the Partner_User
6. IF the Primary_User has disabled partner reminders via sharing controls, THEN THE System SHALL not send reminders to the Partner_User regardless of the Partner_User's own reminder settings

### Requirement 19: Tone and Language Compliance

**User Story:** As a user, I want the application to use respectful, emotionally intelligent language throughout, so that the experience feels supportive rather than reductive.

#### Acceptance Criteria

1. THE System SHALL avoid deterministic language in all user-facing content, including absolute statements (e.g., "she will feel", "she always does", "she never wants"), certainty markers (e.g., "definitely", "certainly", "without doubt"), and universal quantifiers applied to the Primary_User's emotions or behavior (e.g., "every time", "always", "never")
2. THE System SHALL use probabilistic framing in all phase descriptions, guidance, and insights content by including variability qualifiers (e.g., "she may tend to", "common tendencies include", "some women experience", "this phase is often associated with") in every statement describing the Primary_User's emotional state, energy level, or behavioral pattern
3. THE System SHALL avoid stereotyping language in all user-facing content, defined as: attributing a fixed emotional state to a Cycle_Phase without variability language, describing the Primary_User's reactions as inevitable or uniform, or presenting mood patterns as the sole defining characteristic of the Primary_User during any phase
4. THE System SHALL use second-person collaborative framing (e.g., "you might notice", "consider trying", "this could be a good time to") rather than directive or instructional framing (e.g., "you must", "you need to", "do this") in all Guidance_Panel content, Daily_Summary content, and Email_Notification content
5. THE System SHALL include at least one acknowledgment of individual variation (e.g., "every person is different", "your partner's experience may vary") per Cycle_Phase description displayed on the Insights_Dashboard and Guidance_Panel

### Requirement 20: Primary User Onboarding Profile Survey

**User Story:** As a woman, I want to complete a short onboarding survey when I create my profile, so that the system can tailor recommendations for my partner based on my self-described patterns rather than generic assumptions.

#### Acceptance Criteria

1. WHEN the Primary_User completes account creation, THE System SHALL present the Onboarding_Survey consisting of exactly six questions before granting access to the Primary_Dashboard
2. THE System SHALL present Question 1 (Cycle Experience Baseline) with the prompt "How would you describe your typical cycle experience?" and the following response options: "Very predictable (I usually notice clear patterns each month)", "Somewhat predictable (I notice patterns, but they vary)", "Unpredictable (each cycle feels different)", and "Not sure yet"
3. THE System SHALL present Question 2 (Emotional Sensitivity Pattern) with the prompt "During your cycle, how much do your emotions tend to change?" and the following response options: "Slightly (subtle shifts, still stable overall)", "Moderately (noticeable mood changes)", "Strongly (clear emotional shifts across phases)", and "Very strongly (emotions feel significantly different day to day)"
4. THE System SHALL present Question 3 (Social Energy Preference) with the prompt "How does your social energy typically change during your cycle?" and the following response options: "Mostly consistent across all phases", "I need more alone time in certain phases", "I become significantly more social in some phases", and "It varies a lot and is hard to predict"
5. THE System SHALL present Question 4 (Conflict and Sensitivity Triggers) with the prompt "What tends to affect your mood most during sensitive phases?" and the following response options: "Feeling unheard or not understood", "Stress / workload / fatigue", "Social situations or overstimulation", "Relationship dynamics or communication tone", "I don't notice clear triggers", and "Other" with a free-text field limited to 200 characters
6. THE System SHALL present Question 5 (Preferred Support Style) with the prompt "When you're feeling low or sensitive, what kind of support helps most?" and the following response options: "Space and minimal interaction", "Emotional reassurance and empathy", "Practical help (tasks, comfort, routines)", "Distraction / fun activities", and "I prefer different things depending on the day"
7. THE System SHALL present Question 6 (Communication Boundaries and Preferences) with the prompt "How would you like your partner to engage with you during difficult phases?" and the following response options: "Check in gently, but don't push for deep conversation", "Be direct and ask what I need", "Give me space unless I initiate contact", "Stay emotionally present but low-pressure", and "It depends on the situation"
8. THE System SHALL allow the Primary_User to select exactly one response per question for Questions 1, 2, 3, 5, 6, and 7, and allow the Primary_User to select one or more responses for Question 4 (Conflict and Sensitivity Triggers)
9. WHEN the Primary_User completes all six Onboarding_Survey questions, THE System SHALL store the Survey_Responses as part of the Primary_User's profile
10. THE System SHALL use Survey_Responses to calibrate the intensity and type of guidance displayed to the Partner_User on the Insights_Dashboard, Guidance_Panel, Daily_Summary, and Email_Notifications
11. WHEN the Survey_Response for Question 1 indicates "Very predictable", THE System SHALL apply high-confidence phase-based assumptions in Partner_User guidance, and WHEN the response indicates "Not sure yet" or "Unpredictable", THE System SHALL apply low-confidence framing with increased variability qualifiers in Partner_User guidance
12. WHEN the Survey_Response for Question 2 indicates "Slightly", THE System SHALL present emotional guidance to the Partner_User with reduced emphasis, and WHEN the response indicates "Very strongly", THE System SHALL present emotional guidance with heightened emphasis and additional context
13. THE System SHALL use the Survey_Response for Question 3 to tailor social energy recommendations shown to the Partner_User, presenting "give space" guidance when the response indicates a need for alone time and "engage more" guidance when the response indicates increased sociability
14. THE System SHALL use the Survey_Response for Question 4 to inform the "Avoid This" section of the Daily_Summary and the triggers-to-avoid content in the Guidance_Panel, prioritizing the selected triggers in Partner_User-facing content
15. THE System SHALL use the Survey_Response for Question 5 to generate the "Best Approach" section of the Daily_Summary and the recommended supportive actions in the Guidance_Panel, aligning suggestions with the Primary_User's stated support preferences
16. THE System SHALL use the Survey_Response for Question 6 to calibrate communication-related guidance shown to the Partner_User, adjusting recommendations for check-in frequency, conversation depth, and initiation behavior based on the selected preference
17. THE System SHALL allow the Primary_User to update any Survey_Response at any time from the profile settings section
18. WHEN the Primary_User updates a Survey_Response, THE System SHALL recalibrate all Partner_User-facing guidance based on the updated response within 60 seconds
19. THE System SHALL present the Onboarding_Survey using supportive, non-clinical language consistent with the tone requirements defined in Requirement 19
20. THE System SHALL not share raw Survey_Responses with the Partner_User; only the calibrated guidance derived from the responses SHALL be visible to the Partner_User

---

## Non-Functional Requirements

### Requirement 21: Code Quality and Maintainability

**User Story:** As a developer, I want the codebase to follow industry-standard best practices with clear, readable code, so that I can efficiently understand, extend, and maintain the system.

#### Acceptance Criteria

1. THE codebase SHALL follow consistent naming conventions across all files, using camelCase for variables and functions, PascalCase for types and components, and kebab-case for file names
2. THE codebase SHALL organize code into well-separated modules with clear boundaries between business logic (services), data access (database queries), API layer (routes), and presentation layer (components)
3. THE codebase SHALL ensure each module, service, and component has a single, well-defined responsibility following the Single Responsibility Principle
4. THE codebase SHALL implement reusable utility functions and shared components to avoid code duplication, with no logic duplicated across more than two locations
5. THE codebase SHALL include JSDoc comments for all exported functions, service methods, and complex algorithms explaining purpose, parameters, and return values
6. THE codebase SHALL avoid deeply nested logic (maximum 3 levels of nesting) by extracting helper functions and using early returns
7. THE codebase SHALL use TypeScript strict mode with no `any` types in production code, ensuring full type safety across all modules

### Requirement 22: Human-Developer Supportability

**User Story:** As a new developer joining the project, I want the architecture to be straightforward and well-documented, so that I can onboard quickly and contribute effectively without deep reliance on the original authoring context.

#### Acceptance Criteria

1. THE project SHALL include a README.md with setup instructions, architecture overview, environment variable documentation, and common development workflows
2. THE codebase SHALL use standard, well-known patterns and libraries (as defined in the design document) rather than custom abstractions unless the custom approach provides a clear, documented benefit
3. THE codebase SHALL organize files in a predictable directory structure where file location can be inferred from its purpose (e.g., services in `/services`, components in `/components`, API routes in `/app/api`)
4. THE codebase SHALL avoid opaque abstractions that hide control flow; all service interactions and data transformations SHALL be traceable through explicit function calls rather than implicit magic
5. THE codebase SHALL include inline comments only where the code's intent is non-obvious, avoiding redundant comments that restate what the code already expresses

### Requirement 23: Long-Term Maintainability

**User Story:** As a product owner, I want the system designed for long-term evolution, so that new features can be added and existing features modified without major refactoring or accumulating technical debt.

#### Acceptance Criteria

1. THE architecture SHALL separate business logic from framework-specific code, allowing services to be tested and reused independently of Next.js, Supabase, or any specific UI framework
2. THE codebase SHALL define clear interfaces (TypeScript types/interfaces) between all service boundaries, enabling any service implementation to be replaced without affecting consumers
3. THE codebase SHALL avoid tight coupling between features; adding or modifying one feature SHALL NOT require changes to unrelated features
4. THE codebase SHALL use dependency injection or explicit parameter passing for service dependencies rather than hard-coded imports of concrete implementations where testability requires it
5. THE database schema SHALL use migrations for all schema changes, ensuring the database can be reliably reproduced and evolved across environments

### Requirement 24: Engineering Standards Compliance

**User Story:** As a development team, I want automated tooling to enforce code quality standards consistently, so that the codebase remains clean and uniform regardless of who contributes.

#### Acceptance Criteria

1. THE project SHALL configure ESLint with a strict TypeScript ruleset and enforce zero lint errors in CI before merge
2. THE project SHALL configure Prettier for consistent code formatting and enforce formatting compliance in CI
3. THE project SHALL enforce TypeScript strict mode (`strict: true` in tsconfig.json) with no suppression comments (`@ts-ignore`, `@ts-expect-error`) in production code unless accompanied by a justification comment
4. THE project SHALL achieve a minimum of 80% code coverage for business logic (services and utilities) as measured by vitest coverage reporting
5. THE project SHALL include a pre-commit hook (via husky or similar) that runs linting and formatting checks before allowing commits
6. THE project SHALL define and enforce import ordering rules (external dependencies first, then internal modules, then relative imports) via ESLint configuration
