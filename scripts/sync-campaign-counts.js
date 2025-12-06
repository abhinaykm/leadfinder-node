const db = require('../config/dbconnection');

async function syncCampaignCounts() {
    try {
        console.log('🔄 Syncing campaign lead counts...');

        // Check if trigger exists
        const triggerCheck = await db.query(`
            SELECT trigger_name, event_object_table, action_statement
            FROM information_schema.triggers
            WHERE trigger_name = 'trigger_update_campaign_leads_count'
               OR trigger_name = 'update_leads_count';
        `);

        console.log('\n📋 Trigger status:');
        if (triggerCheck.rows.length > 0) {
            console.log('✅ Trigger found:', triggerCheck.rows);
        } else {
            console.log('❌ Trigger NOT found! Creating it...');

            // Create the trigger
            await db.query(`
                CREATE OR REPLACE FUNCTION update_campaign_leads_count()
                RETURNS TRIGGER AS $$
                BEGIN
                    IF TG_OP = 'INSERT' AND NEW.campaign_uuid IS NOT NULL THEN
                        UPDATE campaigns SET leads_count = leads_count + 1 WHERE uuid = NEW.campaign_uuid;
                    ELSIF TG_OP = 'DELETE' AND OLD.campaign_uuid IS NOT NULL THEN
                        UPDATE campaigns SET leads_count = GREATEST(leads_count - 1, 0) WHERE uuid = OLD.campaign_uuid;
                    ELSIF TG_OP = 'UPDATE' AND OLD.campaign_uuid IS DISTINCT FROM NEW.campaign_uuid THEN
                        IF OLD.campaign_uuid IS NOT NULL THEN
                            UPDATE campaigns SET leads_count = GREATEST(leads_count - 1, 0) WHERE uuid = OLD.campaign_uuid;
                        END IF;
                        IF NEW.campaign_uuid IS NOT NULL THEN
                            UPDATE campaigns SET leads_count = leads_count + 1 WHERE uuid = NEW.campaign_uuid;
                        END IF;
                    END IF;
                    RETURN COALESCE(NEW, OLD);
                END;
                $$ language 'plpgsql';

                DROP TRIGGER IF EXISTS trigger_update_campaign_leads_count ON saved_leads;
                CREATE TRIGGER trigger_update_campaign_leads_count
                AFTER INSERT OR UPDATE OR DELETE ON saved_leads
                FOR EACH ROW EXECUTE FUNCTION update_campaign_leads_count();
            `);
            console.log('✅ Trigger created successfully!');
        }

        // Update all campaign counts to match actual saved_leads count
        const result = await db.query(`
            UPDATE campaigns c
            SET leads_count = (
                SELECT COUNT(*)
                FROM saved_leads sl
                WHERE sl.campaign_uuid = c.uuid
            )
            RETURNING uuid, name, leads_count;
        `);

        console.log('\n✅ Updated campaign counts:');
        result.rows.forEach(campaign => {
            console.log(`  - ${campaign.name}: ${campaign.leads_count} leads`);
        });

        console.log('\n✨ Sync completed successfully!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error syncing campaign counts:', error);
        process.exit(1);
    }
}

syncCampaignCounts();
