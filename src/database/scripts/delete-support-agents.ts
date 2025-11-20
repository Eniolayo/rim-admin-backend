import { DataSource } from 'typeorm';
import dataSource from '../data-source';
import { SupportAgent } from '../../entities/support-agent.entity';
import { SupportTicket } from '../../entities/support-ticket.entity';
import { ChatMessage } from '../../entities/chat-message.entity';
import { TicketHistory } from '../../entities/ticket-history.entity';

async function deleteAllSupportAgentsAndTickets(): Promise<void> {
  console.log('==========================================');
  console.log('Delete All Support Agents & Tickets Script');
  console.log('==========================================\n');

  try {
    // Initialize DataSource
    if (!dataSource.isInitialized) {
      console.log('📡 Connecting to database...');
      await dataSource.initialize();
      console.log('✅ Database connected\n');
    }

    // Delete related entities first (due to foreign key constraints)
    // 1. Delete Chat Messages
    const chatMessageRepository = dataSource.getRepository(ChatMessage);
    const chatMessageCount = await chatMessageRepository.count();
    if (chatMessageCount > 0) {
      console.log(
        `📊 Found ${chatMessageCount} chat message(s) in the database`,
      );
      console.log('🗑️  Deleting all chat messages...');
      const chatResult = await chatMessageRepository
        .createQueryBuilder()
        .delete()
        .execute();
      console.log(
        `✅ Successfully deleted ${chatResult.affected || 0} chat message(s)\n`,
      );
    } else {
      console.log('ℹ️  No chat messages to delete.\n');
    }

    // 2. Delete Ticket History
    const ticketHistoryRepository = dataSource.getRepository(TicketHistory);
    const ticketHistoryCount = await ticketHistoryRepository.count();
    if (ticketHistoryCount > 0) {
      console.log(
        `📊 Found ${ticketHistoryCount} ticket history record(s) in the database`,
      );
      console.log('🗑️  Deleting all ticket history records...');
      const historyResult = await ticketHistoryRepository
        .createQueryBuilder()
        .delete()
        .execute();
      console.log(
        `✅ Successfully deleted ${historyResult.affected || 0} ticket history record(s)\n`,
      );
    } else {
      console.log('ℹ️  No ticket history records to delete.\n');
    }

    // 3. Delete Support Tickets
    const supportTicketRepository = dataSource.getRepository(SupportTicket);
    const ticketCount = await supportTicketRepository.count();
    if (ticketCount > 0) {
      console.log(`📊 Found ${ticketCount} support ticket(s) in the database`);
      console.log('🗑️  Deleting all support tickets...');
      const ticketResult = await supportTicketRepository
        .createQueryBuilder()
        .delete()
        .execute();
      console.log(
        `✅ Successfully deleted ${ticketResult.affected || 0} support ticket(s)\n`,
      );
    } else {
      console.log('ℹ️  No support tickets to delete.\n');
    }

    // 4. Delete Support Agents
    const supportAgentRepository = dataSource.getRepository(SupportAgent);
    const agentCount = await supportAgentRepository.count();
    if (agentCount > 0) {
      console.log(`📊 Found ${agentCount} support agent(s) in the database`);
      console.log('🗑️  Deleting all support agents...');
      const agentResult = await supportAgentRepository
        .createQueryBuilder()
        .delete()
        .execute();
      console.log(
        `✅ Successfully deleted ${agentResult.affected || 0} support agent(s)\n`,
      );
    } else {
      console.log('ℹ️  No support agents to delete.\n');
    }

    console.log('==========================================');
    console.log('✅ Script completed successfully!');
    console.log('==========================================');
  } catch (error) {
    console.error('❌ Error during deletion:', error);
    throw error;
  } finally {
    // Close DataSource connection
    if (dataSource.isInitialized) {
      await dataSource.destroy();
      console.log('\n📡 Database connection closed');
    }
  }
}

// Run the script if this file is executed directly
if (require.main === module) {
  deleteAllSupportAgentsAndTickets()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { deleteAllSupportAgentsAndTickets };
