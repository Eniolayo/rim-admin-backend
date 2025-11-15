import * as bcrypt from 'bcrypt';
import dataSource from '../data-source';
import { AdminRole, Permission } from '../../entities/admin-role.entity';
import { AdminUser, AdminUserStatus } from '../../entities/admin-user.entity';

const SALT_ROUNDS = 12;
const DEFAULT_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Password123!';

interface RoleSeedData {
  name: string;
  description: string;
  permissions: Permission[];
}

interface UserSeedData {
  username: string;
  email: string;
  roleName: string;
}

const rolesToSeed: RoleSeedData[] = [
  {
    name: 'super_Admin',
    description: 'Full system access with all permissions',
    permissions: [
      { resource: 'users', actions: ['read', 'write', 'delete'] },
      { resource: 'loans', actions: ['read', 'write', 'delete'] },
      { resource: 'transactions', actions: ['read', 'write', 'delete'] },
      { resource: 'support', actions: ['read', 'write', 'delete'] },
      { resource: 'settings', actions: ['read', 'write', 'delete'] },
      { resource: 'notifications', actions: ['read', 'write', 'delete'] },
    ],
  },
  {
    name: 'Admin',
    description: 'Can manage loans, transactions, and financial reports',
    permissions: [
      { resource: 'loans', actions: ['read', 'write'] },
      { resource: 'transactions', actions: ['read', 'write'] },
      { resource: 'users', actions: ['read'] },
    ],
  },
  {
    name: 'moderator',
    description: 'Can manage support tickets and view user information',
    permissions: [
      { resource: 'users', actions: ['read'] },
      { resource: 'support', actions: ['read', 'write'] },
      { resource: 'loans', actions: ['read'] },
    ],
  },
];

const usersToSeed: UserSeedData[] = [
  {
    username: 'superadmin33',
    email: 'superadmin33@test33.com',
    roleName: 'super_Admin',
  },
];

async function seedAdminRoles(): Promise<Map<string, AdminRole>> {
  console.log('🌱 Seeding AdminRoles...');
  const roleRepository = dataSource.getRepository(AdminRole);
  const roleMap = new Map<string, AdminRole>();

  for (const roleData of rolesToSeed) {
    let role = await roleRepository.findOne({
      where: { name: roleData.name },
    });

    if (!role) {
      console.log(`  Creating role: ${roleData.name}`);
      role = roleRepository.create({
        name: roleData.name,
        description: roleData.description,
        permissions: roleData.permissions,
        userCount: 0,
      });
      role = await roleRepository.save(role);
      console.log(`  ✅ Created role: ${roleData.name} (${role.id})`);
    } else {
      console.log(`  ⏭️  Role already exists: ${roleData.name}`);
    }

    roleMap.set(roleData.name, role);
  }

  console.log(`✅ Completed seeding ${roleMap.size} AdminRoles\n`);
  return roleMap;
}

async function seedAdminUsers(roleMap: Map<string, AdminRole>): Promise<void> {
  console.log('🌱 Seeding AdminUsers...');
  const userRepository = dataSource.getRepository(AdminUser);
  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

  let createdCount = 0;
  let skippedCount = 0;

  for (const userData of usersToSeed) {
    const role = roleMap.get(userData.roleName);
    if (!role) {
      console.error(
        `  ❌ Role not found: ${userData.roleName} for user ${userData.email}`,
      );
      continue;
    }

    const existingUser =
      (await userRepository.findOne({
        where: { email: userData.email },
      })) ||
      (await userRepository.findOne({
        where: { username: userData.username },
      }));

    if (existingUser) {
      console.log(
        `  ⏭️  User already exists: ${userData.email} (${userData.username})`,
      );
      skippedCount++;
      continue;
    }

    console.log(`  Creating user: ${userData.email} (${userData.username})`);
    const user = userRepository.create({
      username: userData.username,
      email: userData.email,
      password: hashedPassword,
      role: role.name,
      roleId: role.id,
      status: AdminUserStatus.ACTIVE,
      twoFactorEnabled: false,
      otpSecret: null,
      refreshToken: null,
      lastLogin: null,
      createdBy: null,
    });

    await userRepository.save(user);

    // Update role userCount
    role.userCount = (role.userCount || 0) + 1;
    await dataSource.getRepository(AdminRole).save(role);

    console.log(
      `  ✅ Created user: ${userData.email} (${userData.username}) with role ${role.name}`,
    );
    createdCount++;
  }

  console.log(
    `✅ Completed seeding AdminUsers: ${createdCount} created, ${skippedCount} skipped\n`,
  );
}

async function runSeed(): Promise<void> {
  console.log('==========================================');
  console.log('Admin Seeding Script');
  console.log('==========================================\n');

  try {
    // Initialize DataSource
    if (!dataSource.isInitialized) {
      console.log('📡 Connecting to database...');
      await dataSource.initialize();
      console.log('✅ Database connected\n');
    }

    // Seed roles first
    const roleMap = await seedAdminRoles();

    // Seed users
    await seedAdminUsers(roleMap);

    console.log('==========================================');
    console.log('✅ Seeding completed successfully!');
    console.log('==========================================');
    console.log('\n📝 Seeded Admin Roles:');
    rolesToSeed.forEach((role) => {
      console.log(`   - ${role.name}`);
    });
    console.log('\n📝 Seeded Admin Users:');
    usersToSeed.forEach((user) => {
      console.log(`   - ${user.email} (${user.username}) - ${user.roleName}`);
    });
    console.log(`\n🔑 Default password: ${DEFAULT_PASSWORD}`);
    console.log('⚠️  All users have 2FA disabled (will be forced to set up on first login)\n');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  } finally {
    // Close DataSource connection
    if (dataSource.isInitialized) {
      await dataSource.destroy();
      console.log('📡 Database connection closed');
    }
  }
}

// Run the seed if this file is executed directly
if (require.main === module) {
  runSeed()
    .then(() => {
      console.log('✅ Seed script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seed script failed:', error);
      process.exit(1);
    });
}

export { runSeed };

