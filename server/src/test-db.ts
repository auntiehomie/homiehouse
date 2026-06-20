import { BotReplyService } from './db';

async function testDatabase() {
  console.log('🧪 Testing database connection...');
  console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
  console.log('SUPABASE_KEY:', process.env.SUPABASE_KEY ? 'SET' : 'NOT SET');
  
  // Test writing a record
  const testHash = `test_${Date.now()}`;
  console.log('\n📝 Testing write...');
  await BotReplyService.recordReply(testHash, 'test_reply', 'test', 'Test reply text');
  
  // Test reading
  console.log('\n📖 Testing read...');
  const hasReplied = await BotReplyService.hasRepliedTo(testHash);
  console.log('Has replied:', hasReplied);
  
  console.log('\n✅ Test complete!');
}

testDatabase().catch(console.error);
