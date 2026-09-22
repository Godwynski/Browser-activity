# Lab 2: Build your VPC and Launch a Web Server

## Lab Overview and Objectives

In this lab, you will use Amazon Virtual Private Cloud (VPC) to create your own VPC and add additional components to produce a customized network. You will also create a security group. You will then configure and customize an EC2 instance to run a web server and you will launch the EC2 instance to run in a subnet in the VPC.

Amazon Virtual Private Cloud (Amazon VPC) enables you to launch Amazon Web Services (AWS) resources into a virtual network that you defined. This virtual network closely resembles a traditional network that you would operate in your own data center, with the benefits of using the scalable infrastructure of AWS. You can create a VPC that spans multiple Availability Zones.

After completing this lab, you should be able to do the following:
* Create a VPC.
* Create subnets.
* Configure a security group.
* Launch an EC2 instance into a VPC.

## Duration
This lab takes approximately 30 minutes to complete.

## Required Tasks Specification

### Task 1: Create Your VPC
- Region: **N. Virginia (us-east-1)**
- VPC Settings: **VPC and more**
- Name tag auto-generation: Value `lab` (produces `lab-vpc`)
- IPv4 CIDR block: `10.0.0.0/16`
- Number of Availability Zones: `1` (`us-east-1a`)
- Number of public subnets: `1`
- Number of private subnets: `1`
- Customize subnets CIDR blocks:
  - Public subnet CIDR block in `us-east-1a`: `10.0.0.0/24` (`lab-subnet-public1-us-east-1a`)
  - Private subnet CIDR block in `us-east-1a`: `10.0.1.0/24` (`lab-subnet-private1-us-east-1a`)
- NAT gateways: **In 1 AZ** (`lab-nat-public1-us-east-1a`)
- VPC endpoints: **None**
- DNS hostnames and DNS resolution: **Enabled**
- Route Tables:
  - `lab-rtb-public` (routes `0.0.0.0/0` to `lab-igw`)
  - `lab-rtb-private1-us-east-1a` (routes `0.0.0.0/0` to `lab-nat-public1-us-east-1a`)

### Task 2: Create Additional Subnets
In the second Availability Zone (`us-east-1b`):
1. **Public Subnet 2**:
   - VPC: `lab-vpc`
   - Subnet name: `lab-subnet-public2`
   - Availability Zone: `us-east-1b`
   - IPv4 CIDR block: `10.0.2.0/24`
2. **Private Subnet 2**:
   - VPC: `lab-vpc`
   - Subnet name: `lab-subnet-private2`
   - Availability Zone: `us-east-1b`
   - IPv4 CIDR block: `10.0.3.0/24`
3. **Route Table Associations**:
   - `lab-rtb-private1-us-east-1a`: Edit explicit subnet associations to include both `lab-subnet-private1-us-east-1a` and `lab-subnet-private2`.
   - `lab-rtb-public`: Edit explicit subnet associations to include both `lab-subnet-public1-us-east-1a` and `lab-subnet-public2`.

### Task 3: Create a VPC Security Group
- Security group name: `Web Security Group`
- Description: `Enable HTTP access`
- VPC: `lab-vpc`
- Inbound rules:
  - Type: `HTTP`
  - Port: `80`
  - Source: `Anywhere-IPv4` (`0.0.0.0/0`)
  - Description: `Permit web requests`

### Task 4: Launch a Web Server Instance
- Name: `Web Server 1`
- AMI: **Amazon Linux 2023 AMI**
- Instance Type: `t2.micro`
- Key pair: `vockey`
- Network Settings:
  - Network: `lab-vpc`
  - Subnet: `lab-subnet-public2`
  - Auto-assign public IP: `Enable`
  - Firewall (security groups): Select existing security group -> `Web Security Group`
- Storage: 8 GiB gp3 (default)
- Advanced details -> User data:
```bash
#!/bin/bash
# Install Apache Web Server and PHP
dnf install -y httpd wget php mariadb105-server
# Download Lab files
wget https://aws-tc-largeobjects.s3.us-west-2.amazonaws.com/CUR-TF-100-ACCLFO-2/2-lab2-vpc/s3/lab-app.zip
unzip lab-app.zip -d /var/www/html/
# Turn on web server
chkconfig httpd on
service httpd start
```
- Wait for instance status checks: **2/2 checks passed**
- Test Public IPv4 DNS in browser to verify web application.

### Task 5: Submit Lab
- Choose **Submit** at the top of Vocareum instructions.
- Confirm submission and verify grading score.
