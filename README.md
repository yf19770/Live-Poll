
# Live Poll - Real-Time Audience Engagement
[![Support us on Buy Me a Coffee](https://img.shields.io/badge/Support-Buy%20Me%20a%20Coffee-yellow.svg)](https://buymeacoffee.com/osfy)
<div align="center">

**A free, open-source, and self-hostable platform for creating nice and simple live polls.**


</div>

<p align="center">
  <img src="https://i.ibb.co/2YHL7bVg/Screenshot-2025-08-12-at-12-08-30-AM.png" alt="Live Poll Dashboard Preview" width="800px">
</p>

## Features

-   **Intuitive Admin Dashboard:** Effortlessly create and manage polls with multiple questions.
-   **Live Presenter View:** A clean, beautiful display screen designed for projectors, with animated charts to captivate the audience.
-   **Easy Audience Participation:** Audience members can join instantly via a simple link or by scanning a QR code.
-   **Flexible Chart Types:** Visualize results with Bar, Pie, or Doughnut charts on a per-question basis.
-   **Real-Time Analytics:** Track engagement and analyze responses with a clean, data-rich results tab.
-   **100% Open Source & Self-Hostable:** Take full control. Host it on your own Firebase project for free and own your data completely. No telemetry, no subscriptions.
-   **Modern UI:** A clean, responsive interface that works on desktop and mobile.

## Tech Stack

-   **Frontend:** Vanilla JavaScript (ES6 Modules), HTML5, CSS3
-   **Backend & Database:** Google Firebase
    -   **Authentication:** For secure user logins.
    -   **Firestore:** For storing all app data (polls, questions, votes).
    -   **Hosting:** For deploying the entire web application.

---

## Getting Started

Follow these instructions to get a copy of the project up and running on your own Firebase account.

### Prerequisites

-   A [Google Firebase](https://firebase.google.com/) account (the free "Spark" plan is sufficient).
-   [Visual Studio Code](https://code.visualstudio.com/) with the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension is recommended for local development.

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/yf19770/Live-Poll.git
    cd Live-Poll
    ```

2.  **Create a Firebase Project:**
    -   Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
    -   In your new project, you must enable the following services from the **Build** menu:
        -   **Authentication:** Click "Get started," and enable **Email/Password** as a Sign-in provider.
        -   **Firestore Database:** Create a new Firestore database. Start in **test mode** for an easy setup.

3.  **Get your Firebase Configuration:**
    -   In your Firebase project console, go to **Project Settings** (click the gear icon ⚙️).
    -   In the "General" tab, scroll down to "Your apps."
    -   Click the web icon (`</>`) to create a new Web App.
    -   Give it a nickname and register the app.
    -   Firebase will provide you with a `firebaseConfig` object. **Copy this entire object.**

4.  **Configure the Project (`js/app.js`):**
    -   In the cloned project, open the file `js/app.js`.
    -   Replace the placeholder `firebaseConfig` object with the one you copied from your Firebase console.

5.  **Run Locally:**
    -   In VS Code, right-click the `index.html` file and select "Open with Live Server".

---

## 🔐 Security Rules - IMPORTANT!

The "test mode" configuration for Firestore allows open access to your database for 30 days. This is convenient for setup but is **not secure** for a production environment.

For any public-facing event, you must update your security rules to ensure only authenticated users can access their own data.

<details>
<summary><strong>Click to expand suggested Firestore Security Rules</strong></summary>

Go to your **Firebase Console -> Firestore Database -> Rules** tab and paste the following, then click **Publish**:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // The /users path is only writable by the owner and not publicly readable.
    match /users/{userId} {
      allow write: if request.auth.uid == userId;

      // The 'polls' subcollection
      match /polls/{pollId} {
        // Allow the public to GET a single poll, but not list them.
        allow get: if true;
        // Allow the OWNER to perform any READ operation (get AND list).
        allow read: if request.auth.uid == userId;
        
        // Allow the OWNER to write.
        allow write: if request.auth.uid == userId;

        // The 'questions' subcollection (repeating the same pattern)
        match /questions/{questionId} {
          allow get: if true;
          allow read: if request.auth.uid == userId;
          allow write: if request.auth.uid == userId;

          // The 'results' subcollection
          match /results/{resultDocId} {
            allow get: if true;
            allow read: if request.auth.uid == userId;
            
            // Allow an update only if it's a valid vote.
            allow update: if isValidVote();

            // Only the owner can create or delete the results document.
            allow create, delete: if request.auth.uid == userId;
          }
        }
      }
    }
  }

  function isValidVote() {
    let beforeCounts = resource.data.counts;
    let afterCounts = request.resource.data.counts;
    
    // Rule 1: The document must only contain the 'counts' map.
    let docKeysUnchanged = request.resource.data.keys().hasOnly(['counts']);

    // Rule 2: No options can be added or removed from the 'counts' map.
    let mapKeysUnchanged = beforeCounts.keys() == afterCounts.keys();

    return docKeysUnchanged && mapKeysUnchanged;
  }
}
```
This is a basic rule set. You can [learn more about securing your data here](https://firebase.google.com/docs/firestore/security/get-started).

</details>

---

## 🚢 Deployment

1.  **Install Firebase CLI:**
    ```bash
    npm install -g firebase-tools
    ```
2.  **Login and Initialize:**
    ```bash
    firebase login
    firebase init hosting
    ```
    -   Choose to **Use an existing project** and select your project.
    -   Use **`.`** (a single dot) as your public directory.
    -   File `index.html` already exists. **Do not overwrite**.

3.  **Deploy:**
    ```bash
    firebase deploy --only hosting
    ```

Your application will be live at the hosting URL provided by Firebase.


## 💖 Support The Project

If you find Live Poll useful and want to support its development, you can buy me a coffee! It's a small gesture that is greatly appreciated.

<a href="https://buymeacoffee.com/osfy">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="45">
</a>
