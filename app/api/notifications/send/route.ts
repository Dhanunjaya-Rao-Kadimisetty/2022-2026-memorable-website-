import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

webpush.setVapidDetails(
  'mailto:saidhanunjaya19@gmail.com', // Using admin email from env if possible
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST() {
  try {
    // 1. Fetch today's birthdays
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;
    
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, birthday');
      
    if (profileError) throw profileError;
    
    const birthdayProfiles = profiles?.filter(p => {
      if (!p.birthday) return false;
      const [_, pMonth, pDay] = p.birthday.split('-').map(Number);
      return pDay === day && pMonth === month;
    }) || [];
    
    if (birthdayProfiles.length === 0) {
      return NextResponse.json({ message: 'No birthdays today.' });
    }
    
    // 2. Fetch all subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('subscription_json');
      
    if (subError) throw subError;
    
    // 3. Send notifications
    const birthdayNames = birthdayProfiles.map(p => p.full_name).join(', ');
    const title = 'Birthday Alert! 🎂';
    const body = `Today is ${birthdayNames}'s birthday! Wish them a great day.`;
    
    const notificationPayload = JSON.stringify({
      title,
      body,
      url: '/yearbook'
    });
    
    const results = await Promise.allSettled(
      subscriptions.map(sub => 
        webpush.sendNotification(sub.subscription_json, notificationPayload)
          .catch(async (err) => {
            if (err.statusCode === 404 || err.statusCode === 410) {
              // Subscription has expired or is no longer valid, delete it
              // We'd need the ID to delete it easily, but we can match by JSON
              console.log('Deleting expired subscription');
              await supabase.from('push_subscriptions').delete().eq('subscription_json', sub.subscription_json);
            }
            throw err;
          })
      )
    );
    
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    
    return NextResponse.json({ 
      message: `Sent ${successCount} notifications for: ${birthdayNames}`,
      successCount 
    });
  } catch (error: any) {
    console.error('Error sending push notifications:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
