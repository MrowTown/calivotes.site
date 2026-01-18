// Resend email integration - using Replit connector
import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return {
    apiKey: connectionSettings.settings.api_key, 
    fromEmail: connectionSettings.settings.from_email
  };
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
export async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

export async function sendVerificationEmail(toEmail: string, code: string): Promise<boolean> {
  try {
    const { client } = await getResendClient();
    
    await client.emails.send({
      from: 'Cali Votes <voting@ifuckfans.com>',
      to: toEmail,
      subject: 'Your Cali Votes verification code',
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #fff; border-radius: 16px;">
          <h1 style="margin: 0 0 16px; font-size: 24px; background: linear-gradient(90deg, #ffd700 0%, #ff6b9d 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">CALI VOTES</h1>
          <p style="margin: 0 0 24px; color: rgba(255,255,255,0.8);">Your verification code is:</p>
          <div style="background: rgba(255,215,0,0.1); border: 2px solid rgba(255,215,0,0.3); border-radius: 12px; padding: 20px; text-align: center; margin: 0 0 24px;">
            <span style="font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #ffd700;">${code}</span>
          </div>
          <p style="margin: 0; color: rgba(255,255,255,0.6); font-size: 14px;">This code expires in 10 minutes.</p>
        </div>
      `
    });
    
    return true;
  } catch (error) {
    console.error('Failed to send verification email:', error);
    return false;
  }
}

export async function sendAdminNotification(city: string, email: string, voteCount: number): Promise<boolean> {
  try {
    const { client } = await getResendClient();
    
    await client.emails.send({
      from: 'Cali Votes <voting@ifuckfans.com>',
      to: 'calireign@protonmail.com',
      subject: `New vote pending approval - ${city}`,
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #fff; border-radius: 16px;">
          <h1 style="margin: 0 0 16px; font-size: 24px; background: linear-gradient(90deg, #ffd700 0%, #ff6b9d 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">CALI VOTES - ADMIN</h1>
          <h2 style="margin: 0 0 16px; font-size: 18px; color: #ffd700;">New Vote Pending Approval</h2>
          <div style="background: rgba(255,255,255,0.1); border-radius: 12px; padding: 16px; margin: 0 0 24px;">
            <p style="margin: 0 0 8px; color: rgba(255,255,255,0.7);">City: <strong style="color: #fff;">${city}</strong></p>
            <p style="margin: 0 0 8px; color: rgba(255,255,255,0.7);">Voter: <strong style="color: #fff;">${email}</strong></p>
            <p style="margin: 0; color: rgba(255,255,255,0.7);">Votes: <strong style="color: #ffd700;">${voteCount}</strong></p>
          </div>
          <p style="margin: 0; color: rgba(255,255,255,0.6); font-size: 14px;">Log in to the admin panel to review and approve this vote.</p>
        </div>
      `
    });
    
    return true;
  } catch (error) {
    console.error('Failed to send admin notification:', error);
    return false;
  }
}

export async function sendVoteApprovedEmail(toEmail: string, city: string, voteCount: number): Promise<boolean> {
  try {
    const { client } = await getResendClient();
    
    await client.emails.send({
      from: 'Cali Votes <voting@ifuckfans.com>',
      to: toEmail,
      subject: 'Your votes have been counted!',
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #fff; border-radius: 16px;">
          <h1 style="margin: 0 0 16px; font-size: 24px; background: linear-gradient(90deg, #ffd700 0%, #ff6b9d 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">CALI VOTES</h1>
          <div style="text-align: center; margin: 24px 0;">
            <span style="font-size: 48px;">🎉</span>
          </div>
          <h2 style="margin: 0 0 16px; font-size: 20px; color: #fff; text-align: center;">Thank You!</h2>
          <p style="margin: 0 0 24px; color: rgba(255,255,255,0.8); text-align: center;">Your payment has been verified and your votes have been counted!</p>
          <div style="background: rgba(255,215,0,0.1); border: 2px solid rgba(255,215,0,0.3); border-radius: 12px; padding: 20px; text-align: center; margin: 0 0 24px;">
            <p style="margin: 0 0 8px; color: rgba(255,255,255,0.7); font-size: 14px;">You voted for</p>
            <p style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: #ffd700;">${city}</p>
            <p style="margin: 0; color: rgba(255,255,255,0.7); font-size: 14px;">${voteCount} vote${voteCount > 1 ? 's' : ''} added</p>
          </div>
          <p style="margin: 0 0 24px; color: rgba(255,255,255,0.6); font-size: 14px; text-align: center;">Check the leaderboard to see how your city is doing!</p>
          <p style="margin: 0; color: #ff6b9d; font-size: 16px; text-align: center; font-style: italic;">Thank you so much. Love ya, -Cali💋💋💋</p>
        </div>
      `
    });
    
    return true;
  } catch (error) {
    console.error('Failed to send vote approved email:', error);
    return false;
  }
}
