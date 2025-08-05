# Firebase Setup Guide for CodLess

This guide will help you set up Firebase for the CodLess authentication system.

## Prerequisites

- A Google account
- Basic knowledge of web development

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter a project name (e.g., "CodLess-Auth")
4. Follow the setup wizard (you can disable Google Analytics if not needed)
5. Click "Create project"

## Step 2: Enable Authentication

1. In your Firebase project dashboard, click on "Authentication" in the left sidebar
2. Click "Get started"
3. Go to the "Sign-in method" tab
4. Enable the following providers:
   - **Email/Password**: Click on it and toggle "Enable"
   - **Google**: Click on it, toggle "Enable", and add your project support email

## Step 3: Set up Firestore Database

1. In the left sidebar, click on "Firestore Database"
2. Click "Create database"
3. Choose "Start in production mode" for security
4. Select your preferred location (choose the closest to your users)
5. Click "Enable"

## Step 4: Configure Security Rules

1. In Firestore, go to the "Rules" tab
2. Replace the default rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // Users can access their own saved runs
      match /savedRuns/{runId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

3. Click "Publish"

## Step 5: Get Your Firebase Configuration

1. In the Firebase console, click on the gear icon ⚙️ next to "Project Overview"
2. Select "Project settings"
3. Scroll down to "Your apps" section
4. Click on the "</>" (Web) icon
5. Register your app with a nickname (e.g., "CodLess Web App")
6. Copy the Firebase configuration object

## Step 6: Update firebase-config.js

1. Open `/workspace/firebase-config.js`
2. Replace the placeholder configuration with your actual Firebase config:

```javascript
const firebaseConfig = {
    apiKey: "your-actual-api-key",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "your-sender-id",
    appId: "your-app-id"
};
```

## Step 7: Configure OAuth Consent Screen (for Google Sign-in)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Navigate to "APIs & Services" > "OAuth consent screen"
4. Choose "External" user type
5. Fill in the required information:
   - App name: CodLess
   - User support email: Your email
   - Developer contact: Your email
6. Add your domain to "Authorized domains" if hosting on a custom domain
7. Save and continue through the remaining steps

## Step 8: Add Authorized Domains

1. Back in Firebase Console, go to Authentication > Settings
2. Under "Authorized domains", add any domains where you'll host the app
3. By default, localhost and your Firebase hosting domain are already authorized

## Step 9: Test Your Setup

1. Open your CodLess app in a web browser
2. Click on the user icon in the top right
3. Try creating an account with email/password
4. Try signing in with Google
5. Verify that your saved runs are being stored in Firestore

## Security Best Practices

1. **Never commit your Firebase config to public repositories** - Consider using environment variables
2. **Regularly review your security rules** - Ensure users can only access their own data
3. **Enable Firebase App Check** (optional) - Adds an extra layer of security
4. **Monitor usage** - Set up budget alerts in Google Cloud Console
5. **Regular backups** - Enable automatic Firestore backups for production use

## Troubleshooting

### "Permission denied" errors
- Check your Firestore security rules
- Ensure the user is properly authenticated
- Verify the data structure matches the security rules

### Google Sign-in not working
- Ensure Google provider is enabled in Firebase Authentication
- Check that your domain is in the authorized domains list
- Verify OAuth consent screen is configured

### Data not syncing
- Check browser console for errors
- Verify Firestore is enabled and accessible
- Ensure offline persistence isn't causing conflicts

## Next Steps

1. Consider implementing:
   - Password reset functionality ✓ (already implemented)
   - Email verification
   - Two-factor authentication
   - Social login providers (Facebook, GitHub, etc.)

2. Set up monitoring:
   - Firebase Analytics
   - Error reporting with Firebase Crashlytics
   - Performance monitoring

3. Optimize for production:
   - Enable Firestore indexes for complex queries
   - Implement data pagination for large datasets
   - Set up Firebase Hosting for deployment

## Support

For issues specific to CodLess authentication, please open an issue on the GitHub repository.
For Firebase-specific issues, consult the [Firebase documentation](https://firebase.google.com/docs).