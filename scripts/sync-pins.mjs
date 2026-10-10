import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Read the extracted students data
const rawDataPath = 'C:/Users/Admin/.gemini/antigravity/brain/0b606ec8-5ccd-4ed8-91dc-18f5d7357c6a/.system_generated/steps/1483/output.txt';
let fileContent = fs.readFileSync(rawDataPath, 'utf8');

// Extract JSON substring
const jsonStart = fileContent.indexOf('{"total":');
const jsonEnd = fileContent.lastIndexOf('}');
const parsed = JSON.parse(fileContent.slice(jsonStart, jsonEnd + 1));

const students = parsed.students || [];

// Add online customer
const onlineCustomer = {
  pin: '833288',
  student_name: 'leminhduc1210',
  eng_name: 'Online Candidate',
  phone: '0969020538',
  email: 'leminhduc1210@gmail.com',
  user_type: 'online',
  classes: ['Khách Online VIP'],
  is_qualified: true,
  package_type: 'VIP',
  expiry: '24/08/2026'
};

const allRecords = [...students, onlineCustomer];

async function sync() {
  console.log(`Syncing ${allRecords.length} records to Supabase table exam_auth_pins...`);
  
  // Upsert in batches of 50
  for (let i = 0; i < allRecords.length; i += 50) {
    const chunk = allRecords.slice(i, i + 50);
    const { data, error } = await supabase
      .from('exam_auth_pins')
      .upsert(chunk, { onConflict: 'pin' });
      
    if (error) {
      console.error('Batch error:', error);
    } else {
      console.log(`Batch ${i / 50 + 1} synced successfully.`);
    }
  }

  // Verify count
  const { count, error: countErr } = await supabase
    .from('exam_auth_pins')
    .select('*', { count: 'exact', head: true });

  console.log(`Finished! Total rows in exam_auth_pins: ${count}`);
}

sync().catch(console.error);
