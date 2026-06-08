# Content Idea Collector

A clean and intuitive web application to save content ideas, post drafts, and inspiration links. Built with HTML, CSS, JavaScript, and Firebase.

## Features

- **User Authentication**: Secure sign-up and login using Firebase Authentication.
- **Dashboard**: View all your saved content ideas in a responsive grid.
- **CRUD Operations**: Add, edit, and delete ideas, drafts, and links.
- **Real-time Updates**: Data syncs instantly across devices using Firestore.

## Setup Instructions

### 1. Firebase Configuration

1.  Go to the [Firebase Console](https://console.firebase.google.com/).
2.  Create a new project named "Content Idea Collector".
3.  **Authentication**: Enable "Email/Password" provider in the Authentication section.
4.  **Firestore Database**:
    - Create a database in "Production mode" or "Test mode".
    - Choose a location.
    - Go to the **Rules** tab and paste the following:
      ```javascript
      rules_version = '2';
      service cloud.firestore {
        match /databases/{database}/documents {
          match /ideas/{ideaId} {
            allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
            allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
          }
        }
      }
      ```
5.  **Add Web App**:
    - Register a new web app in your Firebase project.
    - Copy the `firebaseConfig` object.
    - Open `src/firebase-config.js` and replace the placeholder values with your actual configuration.

### 2. Deployment to Vercel

1.  Push this repository to your GitHub.
2.  Go to [Vercel](https://vercel.com/) and click "Add New" > "Project".
3.  Import this repository.
4.  Vercel will automatically detect the static site. Click **Deploy**.

## n8n Automation Workflows

This application is designed to work with n8n for additional automation.

### Workflow 1: Daily Email Summary
- **Trigger**: Cron (Daily at 8:00 AM).
- **Node**: Firebase (Get Documents from `ideas` collection).
- **Node**: Filter (Filter by `userId`).
- **Node**: HTML/Email (Generate summary and send via Gmail/SendGrid).

### Workflow 2: Google Sheets Backup
- **Trigger**: Cron (Weekly).
- **Node**: Firebase (Get all documents).
- **Node**: Google Sheets (Append rows to a specific sheet).

### Workflow 3: Inactivity Notification
- **Trigger**: Cron (Daily).
- **Node**: Firebase (Query `ideas` where `createdAt` > 7 days ago).
- **Node**: Logic (If no results for a user, send encouragement email).

## Project Structure

```text
├── src/
│   ├── index.html        # Main HTML structure
│   ├── styles.css        # UI Styling
│   ├── app.js            # Frontend logic & Firebase integration
│   └── firebase-config.js # Firebase credentials (edit this!)
└── README.md             # Documentation
```
