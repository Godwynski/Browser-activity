import {
  EC2Client,
  DescribeVpcsCommand,
  DescribeSubnetsCommand,
  DescribeRouteTablesCommand,
  DescribeNatGatewaysCommand,
  DescribeInternetGatewaysCommand,
  DescribeSecurityGroupsCommand,
  DescribeInstancesCommand
} from '@aws-sdk/client-ec2';
import http from 'http';

const CREDENTIALS = {
  accessKeyId: 'ASIAQF3PTJVBM55X7VIY',
  secretAccessKey: 'nTSn36Ls/tvydjdGZUQiETwTsDukf+YoBKjsYB3b',
  sessionToken: 'IQoJb3JpZ2luX2VjENf//////////wEaCXVzLXdlc3QtMiJHMEUCIQCMhBMxzF3sonmfVCzPj/PQCEovjoxvB0m9an4167OphwIgcDhpY7K/hDIbfNFRK+edzko/1W1oCyI6dj2zPPmEV+YqrgIIoP//////////ARAAGgwwMTI1ODIwNzk4MTAiDO5Qr74BKZY+82YvpiqCAhZ5YP6c/Ob0JGbnt6QsO3DvyWfFAyhs8GUU07wJPDLFqD6JJ8DmXX4/hQ/iAQDWZp6lMIFx9lGpPLLHlgbWr6qr2yHZJQTaLscR0ylW1hOyH7kdHypKECeSlb/Z7k705p38tYB/jU0gP59i8UexpkXNyaoWdrE5ueGNvs9x5+OF0sX7IzIqN7Sbfgyq8FcuVz5uQhPIadnwMrwmZCi50z0ciqLEv+h8r7Qnh7DnkP16mHM0ifWK/lfMjiTyrEMKiTMPAmyxCq7MbHJsACsw4TR97iTa+0c5ydvi2zp9e58Ji0FPstiQvo/iAAnEEXtD9b5UmE5SLowcPo7+gR8Vgm8QpDDXv8jVBjqdAejpQDQK00A88Rn39xi10DG1kLoS3VjsXha9/Nj3SGXl0upc1S0afKmeXRYUTnV9wJXVBdoF90m9zkjcgmK7SGhwbQsMZI8Fh3ritocBC9+u6A7ko5dpJM4RjpNUfufXRaeoZQk8PoTmc4fEGdmo1aPF6dO44kknI0hvaYKtYUKFvJ18LQjY0KZQ5akS+8GZjDCKzDeX5pRRvxb8zHM='
};

const REGION = 'us-east-1';
const ec2 = new EC2Client({ region: REGION, credentials: CREDENTIALS });

async function verify() {
  console.log('🔍 Running Verification Audit for Lab 2: Build your VPC and Launch a Web Server...\n');

  // 1. VPC
  const vpcRes = await ec2.send(new DescribeVpcsCommand({
    Filters: [{ Name: 'tag:Name', Values: ['lab-vpc'] }]
  }));
  const vpc = vpcRes.Vpcs[0];
  console.log('1. VPC Verification:');
  console.log(`   - VPC ID:    ${vpc?.VpcId} (${vpc?.CidrBlock})`);
  console.log(`   - State:     ${vpc?.State}`);

  // 2. Subnets
  const subRes = await ec2.send(new DescribeSubnetsCommand({
    Filters: [{ Name: 'vpc-id', Values: [vpc.VpcId] }]
  }));
  console.log('\n2. Subnets Verification:');
  subRes.Subnets.forEach(s => {
    const name = s.Tags?.find(t => t.Key === 'Name')?.Value;
    console.log(`   - ${name.padEnd(32)} | CIDR: ${s.CidrBlock.padEnd(14)} | AZ: ${s.AvailabilityZone} | ID: ${s.SubnetId}`);
  });

  // 3. Route Tables
  const rtbRes = await ec2.send(new DescribeRouteTablesCommand({
    Filters: [{ Name: 'vpc-id', Values: [vpc.VpcId] }]
  }));
  console.log('\n3. Route Tables Verification:');
  rtbRes.RouteTables.forEach(r => {
    const name = r.Tags?.find(t => t.Key === 'Name')?.Value || 'Main/Default';
    console.log(`   - Route Table: ${name} (${r.RouteTableId})`);
    console.log(`     Routes: ${r.Routes.map(ro => `${ro.DestinationCidrBlock} -> ${ro.GatewayId || ro.NatGatewayId || 'local'}`).join(', ')}`);
    console.log(`     Subnet Associations: ${r.Associations.filter(a => a.SubnetId).map(a => a.SubnetId).join(', ') || 'None (Default)'}`);
  });

  // 4. NAT Gateway
  const natRes = await ec2.send(new DescribeNatGatewaysCommand({
    Filters: [{ Name: 'vpc-id', Values: [vpc.VpcId] }]
  }));
  console.log('\n4. NAT Gateway Verification:');
  natRes.NatGateways.forEach(n => {
    console.log(`   - NAT GW ID: ${n.NatGatewayId} | State: ${n.State} | Public IP: ${n.NatGatewayAddresses[0]?.PublicIp}`);
  });

  // 5. Security Group
  const sgRes = await ec2.send(new DescribeSecurityGroupsCommand({
    Filters: [
      { Name: 'vpc-id', Values: [vpc.VpcId] },
      { Name: 'group-name', Values: ['Web Security Group'] }
    ]
  }));
  const sg = sgRes.SecurityGroups[0];
  console.log('\n5. Security Group Verification:');
  console.log(`   - Name:    ${sg?.GroupName} (${sg?.GroupId})`);
  console.log(`   - Inbound: ${JSON.stringify(sg?.IpPermissions)}`);

  // 6. EC2 Web Server
  const instRes = await ec2.send(new DescribeInstancesCommand({
    Filters: [
      { Name: 'vpc-id', Values: [vpc.VpcId] },
      { Name: 'tag:Name', Values: ['Web Server 1'] }
    ]
  }));
  const inst = instRes.Reservations[0]?.Instances[0];
  console.log('\n6. EC2 Web Server Verification:');
  console.log(`   - Instance ID: ${inst?.InstanceId}`);
  console.log(`   - State:       ${inst?.State?.Name}`);
  console.log(`   - Public IP:   ${inst?.PublicIpAddress}`);
  console.log(`   - Public DNS:  ${inst?.PublicDnsName}`);

  // 7. Web Application HTTP check
  if (inst?.PublicIpAddress) {
    console.log('\n7. Web Server Application HTTP Test:');
    await new Promise((resolve) => {
      http.get(`http://${inst.PublicIpAddress}/`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          console.log(`   - HTTP Status: ${res.statusCode}`);
          const titleMatch = data.match(/<title>(.*?)<\/title>/i);
          console.log(`   - Page Title:  ${titleMatch ? titleMatch[1] : 'Found HTML body'}`);
          resolve();
        });
      }).on('error', (err) => {
        console.log(`   - HTTP Check Note: ${err.message}`);
        resolve();
      });
    });
  }
}

verify().catch(console.error);
