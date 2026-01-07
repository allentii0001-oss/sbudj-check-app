
// This service handles interaction with Microsoft OneDrive via Graph API
declare const msal: any;

const SCOPES = ['User.Read', 'Files.ReadWrite.AppFolder'];
const FILE_NAME = 'activity_data.json';

let publicClientApplication: any = null;

export const initializeMsal = async (clientId: string) => {
  if (!clientId) return null;
  
  const msalConfig = {
    auth: {
      clientId: clientId,
      authority: "https://login.microsoftonline.com/common",
      redirectUri: window.location.origin, // e.g., http://localhost:5173
    },
    cache: {
      cacheLocation: "sessionStorage",
      storeAuthStateInCookie: false,
    },
  };

  publicClientApplication = new msal.PublicClientApplication(msalConfig);
  await publicClientApplication.initialize();
  return publicClientApplication;
};

export const signIn = async () => {
  if (!publicClientApplication) throw new Error("MSAL not initialized");
  
  try {
    const loginResponse = await publicClientApplication.loginPopup({
      scopes: SCOPES,
      prompt: "select_account"
    });
    return loginResponse.account;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const signOut = async () => {
    if (!publicClientApplication) return;
    await publicClientApplication.logoutPopup();
};

const getToken = async (account: any) => {
    if (!publicClientApplication) throw new Error("MSAL not initialized");
    try {
        const response = await publicClientApplication.acquireTokenSilent({
            scopes: SCOPES,
            account: account
        });
        return response.accessToken;
    } catch (error) {
        // Fallback to popup
        const response = await publicClientApplication.acquireTokenPopup({
            scopes: SCOPES,
        });
        return response.accessToken;
    }
};

// Upload data to OneDrive (App Folder)
export const uploadDataToCloud = async (account: any, data: any) => {
    const token = await getToken(account);
    const content = JSON.stringify(data, null, 2);
    
    // Using the special 'approot' folder. The user will see this in Apps > {AppName}
    const url = `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${FILE_NAME}:/content`;
    
    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: content
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Upload failed');
    }
    
    return await response.json();
};

// Download data from OneDrive
export const downloadDataFromCloud = async (account: any) => {
    const token = await getToken(account);
    const url = `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${FILE_NAME}:/content`;
    
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (response.status === 404) {
        return null; // File doesn't exist yet
    }

    if (!response.ok) {
        throw new Error('Download failed');
    }

    return await response.json();
};
