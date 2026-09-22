import {
  EC2Client,
  CreateVpcCommand,
  ModifyVpcAttributeCommand,
  CreateSubnetCommand,
  CreateInternetGatewayCommand,
  AttachInternetGatewayCommand,
  AllocateAddressCommand,
  CreateNatGatewayCommand,
  CreateRouteTableCommand,
  CreateRouteCommand,
  AssociateRouteTableCommand,
  CreateSecurityGroupCommand,
  AuthorizeSecurityGroupIngressCommand,
  RunInstancesCommand,
  DescribeNatGatewaysCommand,
  DescribeInstancesCommand
} from '@aws-sdk/client-ec2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CREDENTIALS = {
  accessKeyId: 'ASIAQF3PTJVBM55X7VIY',
  secretAccessKey: 'nTSn36Ls/tvydjdGZUQiETwTsDukf+YoBKjsYB3b',
  sessionToken: 'IQoJb3JpZ2luX2VjENf//////////wEaCXVzLXdlc3QtMiJHMEUCIQCMhBMxzF3sonmfVCzPj/PQCEovjoxvB0m9an4167OphwIgcDhpY7K/hDIbfNFRK+edzko/1W1oCyI6dj2zPPmEV+YqrgIIoP//////////ARAAGgwwMTI1ODIwNzk4MTAiDO5Qr74BKZY+82YvpiqCAhZ5YP6c/Ob0JGbnt6QsO3DvyWfFAyhs8GUU07wJPDLFqD6JJ8DmXX4/hQ/iAQDWZp6lMIFx9lGpPLLHlgbWr6qr2yHZJQTaLscR0ylW1hOyH7kdHypKECeSlb/Z7k705p38tYB/jU0gP59i8UexpkXNyaoWdrE5ueGNvs9x5+OF0sX7IzIqN7Sbfgyq8FcuVz5uQhPIadnwMrwmZCi50z0ciqLEv+h8r7Qnh7DnkP16mHM0ifWK/lfMjiTyrEMKiTMPAmyxCq7MbHJsACsw4TR97iTa+0c5ydvi2zp9e58Ji0FPstiQvo/iAAnEEXtD9b5UmE5SLowcPo7+gR8Vgm8QpDDXv8jVBjqdAejpQDQK00A88Rn39xi10DG1kLoS3VjsXha9/Nj3SGXl0upc1S0afKmeXRYUTnV9wJXVBdoF90m9zkjcgmK7SGhwbQsMZI8Fh3ritocBC9+u6A7ko5dpJM4RjpNUfufXRaeoZQk8PoTmc4fEGdmo1aPF6dO44kknI0hvaYKtYUKFvJ18LQjY0KZQ5akS+8GZjDCKzDeX5pRRvxb8zHM='
};

const REGION = 'us-east-1';
const client = new EC2Client({ region: REGION, credentials: CREDENTIALS });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function deploy() {
  const deployed = {};
  console.log('🚀 Starting AWS Academy Lab 2 Automated Deployment...');

  // ==========================================
  // TASK 1: Create VPC and Base Resources
  // ==========================================
  console.log('\n--- Task 1: Creating lab-vpc (10.0.0.0/16) ---');
  const vpcRes = await client.send(new CreateVpcCommand({
    CidrBlock: '10.0.0.0/16',
    TagSpecifications: [{
      ResourceType: 'vpc',
      Tags: [{ Key: 'Name', Value: 'lab-vpc' }]
    }]
  }));
  const vpcId = vpcRes.Vpc.VpcId;
  deployed.vpcId = vpcId;
  console.log(`✅ Created VPC: ${vpcId}`);

  // Enable DNS hostnames and DNS resolution
  await client.send(new ModifyVpcAttributeCommand({ VpcId: vpcId, EnableDnsHostnames: { Value: true } }));
  await client.send(new ModifyVpcAttributeCommand({ VpcId: vpcId, EnableDnsSupport: { Value: true } }));
  console.log('✅ Enabled DNS Hostnames and DNS Support on VPC');

  // Create Public Subnet 1 (us-east-1a: 10.0.0.0/24)
  console.log('\n--- Creating Public Subnet 1 (us-east-1a: 10.0.0.0/24) ---');
  const pubSub1Res = await client.send(new CreateSubnetCommand({
    VpcId: vpcId,
    CidrBlock: '10.0.0.0/24',
    AvailabilityZone: 'us-east-1a',
    TagSpecifications: [{
      ResourceType: 'subnet',
      Tags: [{ Key: 'Name', Value: 'lab-subnet-public1-us-east-1a' }]
    }]
  }));
  const pubSub1Id = pubSub1Res.Subnet.SubnetId;
  deployed.pubSub1Id = pubSub1Id;
  console.log(`✅ Created Public Subnet 1: ${pubSub1Id}`);

  // Create Private Subnet 1 (us-east-1a: 10.0.1.0/24)
  console.log('\n--- Creating Private Subnet 1 (us-east-1a: 10.0.1.0/24) ---');
  const privSub1Res = await client.send(new CreateSubnetCommand({
    VpcId: vpcId,
    CidrBlock: '10.0.1.0/24',
    AvailabilityZone: 'us-east-1a',
    TagSpecifications: [{
      ResourceType: 'subnet',
      Tags: [{ Key: 'Name', Value: 'lab-subnet-private1-us-east-1a' }]
    }]
  }));
  const privSub1Id = privSub1Res.Subnet.SubnetId;
  deployed.privSub1Id = privSub1Id;
  console.log(`✅ Created Private Subnet 1: ${privSub1Id}`);

  // Create Internet Gateway
  console.log('\n--- Creating Internet Gateway (lab-igw) ---');
  const igwRes = await client.send(new CreateInternetGatewayCommand({
    TagSpecifications: [{
      ResourceType: 'internet-gateway',
      Tags: [{ Key: 'Name', Value: 'lab-igw' }]
    }]
  }));
  const igwId = igwRes.InternetGateway.InternetGatewayId;
  deployed.igwId = igwId;
  await client.send(new AttachInternetGatewayCommand({ InternetGatewayId: igwId, VpcId: vpcId }));
  console.log(`✅ Created and attached IGW: ${igwId}`);

  // Create Route Table for Public Subnet (lab-rtb-public)
  console.log('\n--- Creating Public Route Table (lab-rtb-public) ---');
  const pubRtbRes = await client.send(new CreateRouteTableCommand({
    VpcId: vpcId,
    TagSpecifications: [{
      ResourceType: 'route-table',
      Tags: [{ Key: 'Name', Value: 'lab-rtb-public' }]
    }]
  }));
  const pubRtbId = pubRtbRes.RouteTable.RouteTableId;
  deployed.pubRtbId = pubRtbId;
  await client.send(new CreateRouteCommand({
    RouteTableId: pubRtbId,
    DestinationCidrBlock: '0.0.0.0/0',
    GatewayId: igwId
  }));
  await client.send(new AssociateRouteTableCommand({
    RouteTableId: pubRtbId,
    SubnetId: pubSub1Id
  }));
  console.log(`✅ Configured Public Route Table: ${pubRtbId} -> IGW route added, Subnet 1 associated`);

  // Create Elastic IP & NAT Gateway in Public Subnet 1
  console.log('\n--- Creating NAT Gateway (lab-nat-public1-us-east-1a) ---');
  const eipRes = await client.send(new AllocateAddressCommand({
    Domain: 'vpc',
    TagSpecifications: [{
      ResourceType: 'elastic-ip',
      Tags: [{ Key: 'Name', Value: 'lab-nat-public1-us-east-1a' }]
    }]
  }));
  const allocationId = eipRes.AllocationId;
  deployed.natEip = eipRes.PublicIp;
  console.log(`✅ Allocated EIP: ${eipRes.PublicIp} (${allocationId})`);

  const natRes = await client.send(new CreateNatGatewayCommand({
    AllocationId: allocationId,
    SubnetId: pubSub1Id,
    TagSpecifications: [{
      ResourceType: 'natgateway',
      Tags: [{ Key: 'Name', Value: 'lab-nat-public1-us-east-1a' }]
    }]
  }));
  const natGwId = natRes.NatGateway.NatGatewayId;
  deployed.natGwId = natGwId;
  console.log(`⏳ Created NAT Gateway: ${natGwId}. Waiting for activation...`);

  let natActive = false;
  for (let i = 0; i < 40; i++) {
    await sleep(6000);
    const natCheck = await client.send(new DescribeNatGatewaysCommand({ NatGatewayIds: [natGwId] }));
    const state = natCheck.NatGateways[0]?.State;
    console.log(`   NAT Gateway status: ${state} (${i + 1}/40)`);
    if (state === 'available') {
      natActive = true;
      break;
    }
  }
  if (!natActive) throw new Error('NAT Gateway failed to become available in time');
  console.log('✅ NAT Gateway is now AVAILABLE!');

  // Create Private Route Table (lab-rtb-private1-us-east-1a)
  console.log('\n--- Creating Private Route Table (lab-rtb-private1-us-east-1a) ---');
  const privRtbRes = await client.send(new CreateRouteTableCommand({
    VpcId: vpcId,
    TagSpecifications: [{
      ResourceType: 'route-table',
      Tags: [{ Key: 'Name', Value: 'lab-rtb-private1-us-east-1a' }]
    }]
  }));
  const privRtbId = privRtbRes.RouteTable.RouteTableId;
  deployed.privRtbId = privRtbId;
  await client.send(new CreateRouteCommand({
    RouteTableId: privRtbId,
    DestinationCidrBlock: '0.0.0.0/0',
    NatGatewayId: natGwId
  }));
  await client.send(new AssociateRouteTableCommand({
    RouteTableId: privRtbId,
    SubnetId: privSub1Id
  }));
  console.log(`✅ Configured Private Route Table: ${privRtbId} -> NAT route added, Private Subnet 1 associated`);

  // ==========================================
  // TASK 2: Create Additional Multi-AZ Subnets
  // ==========================================
  console.log('\n--- Task 2: Creating Additional Subnets in us-east-1b ---');
  // Public Subnet 2 (us-east-1b: 10.0.2.0/24)
  const pubSub2Res = await client.send(new CreateSubnetCommand({
    VpcId: vpcId,
    CidrBlock: '10.0.2.0/24',
    AvailabilityZone: 'us-east-1b',
    TagSpecifications: [{
      ResourceType: 'subnet',
      Tags: [{ Key: 'Name', Value: 'lab-subnet-public2' }]
    }]
  }));
  const pubSub2Id = pubSub2Res.Subnet.SubnetId;
  deployed.pubSub2Id = pubSub2Id;
  console.log(`✅ Created Public Subnet 2: ${pubSub2Id}`);

  // Private Subnet 2 (us-east-1b: 10.0.3.0/24)
  const privSub2Res = await client.send(new CreateSubnetCommand({
    VpcId: vpcId,
    CidrBlock: '10.0.3.0/24',
    AvailabilityZone: 'us-east-1b',
    TagSpecifications: [{
      ResourceType: 'subnet',
      Tags: [{ Key: 'Name', Value: 'lab-subnet-private2' }]
    }]
  }));
  const privSub2Id = privSub2Res.Subnet.SubnetId;
  deployed.privSub2Id = privSub2Id;
  console.log(`✅ Created Private Subnet 2: ${privSub2Id}`);

  // Associate new subnets with route tables
  console.log('--- Updating Route Table Associations for AZ 2 ---');
  await client.send(new AssociateRouteTableCommand({
    RouteTableId: pubRtbId,
    SubnetId: pubSub2Id
  }));
  console.log(`✅ Associated lab-subnet-public2 with lab-rtb-public`);

  await client.send(new AssociateRouteTableCommand({
    RouteTableId: privRtbId,
    SubnetId: privSub2Id
  }));
  console.log(`✅ Associated lab-subnet-private2 with lab-rtb-private1-us-east-1a`);

  // ==========================================
  // TASK 3: Create VPC Security Group
  // ==========================================
  console.log('\n--- Task 3: Creating Web Security Group ---');
  const sgRes = await client.send(new CreateSecurityGroupCommand({
    GroupName: 'Web Security Group',
    Description: 'Enable HTTP access',
    VpcId: vpcId,
    TagSpecifications: [{
      ResourceType: 'security-group',
      Tags: [{ Key: 'Name', Value: 'Web Security Group' }]
    }]
  }));
  const sgId = sgRes.GroupId;
  deployed.sgId = sgId;
  console.log(`✅ Created Security Group: ${sgId}`);

  await client.send(new AuthorizeSecurityGroupIngressCommand({
    GroupId: sgId,
    IpPermissions: [{
      IpProtocol: 'tcp',
      FromPort: 80,
      ToPort: 80,
      IpRanges: [{
        CidrIp: '0.0.0.0/0',
        Description: 'Permit web requests'
      }]
    }]
  }));
  console.log('✅ Configured Inbound HTTP rule on port 80 for 0.0.0.0/0');

  // ==========================================
  // TASK 4: Launch Web Server EC2 Instance
  // ==========================================
  console.log('\n--- Task 4: Launching Web Server 1 in lab-subnet-public2 ---');
  const userDataScript = `#!/bin/bash
# Install Apache Web Server and PHP
dnf install -y httpd wget php mariadb105-server
# Download Lab files
wget https://aws-tc-largeobjects.s3.us-west-2.amazonaws.com/CUR-TF-100-ACCLFO-2/2-lab2-vpc/s3/lab-app.zip
unzip lab-app.zip -d /var/www/html/
# Turn on web server
chkconfig httpd on
service httpd start
`;

  const userDataEncoded = Buffer.from(userDataScript).toString('base64');
  const runRes = await client.send(new RunInstancesCommand({
    ImageId: 'ami-0b2c9d1f3edcfd709', // Amazon Linux 2023 in us-east-1
    InstanceType: 't2.micro',
    KeyName: 'vockey',
    MinCount: 1,
    MaxCount: 1,
    UserData: userDataEncoded,
    NetworkInterfaces: [{
      DeviceIndex: 0,
      SubnetId: pubSub2Id,
      Groups: [sgId],
      AssociatePublicIpAddress: true
    }],
    TagSpecifications: [{
      ResourceType: 'instance',
      Tags: [{ Key: 'Name', Value: 'Web Server 1' }]
    }]
  }));

  const instanceId = runRes.Instances[0].InstanceId;
  deployed.instanceId = instanceId;
  console.log(`✅ Instance Launched: ${instanceId}`);

  console.log('⏳ Waiting for instance to attain running state and public IP...');
  let publicDns = '';
  let publicIp = '';
  for (let i = 0; i < 30; i++) {
    await sleep(5000);
    const instCheck = await client.send(new DescribeInstancesCommand({ InstanceIds: [instanceId] }));
    const inst = instCheck.Reservations[0]?.Instances[0];
    if (inst && inst.State?.Name === 'running' && inst.PublicIpAddress) {
      publicDns = inst.PublicDnsName;
      publicIp = inst.PublicIpAddress;
      break;
    }
  }

  deployed.publicDns = publicDns;
  deployed.publicIp = publicIp;
  console.log(`✅ Web Server 1 running!`);
  console.log(`   Public IP:  ${publicIp}`);
  console.log(`   Public DNS: ${publicDns}`);

  // Save deployment artifact
  const outPath = path.join(__dirname, 'deployment_receipt.json');
  fs.writeFileSync(outPath, JSON.stringify(deployed, null, 2), 'utf8');
  console.log(`\n🎉 All Task 1-4 resources deployed and recorded in ${outPath}!`);
}

deploy().catch(err => {
  console.error('\n❌ Deployment Error:', err);
  process.exit(1);
});
