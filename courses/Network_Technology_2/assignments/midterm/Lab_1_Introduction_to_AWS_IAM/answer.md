# Lab 1: Introduction to AWS IAM — Deliverable Report

* **Course**: Information Assurance and Security
* **Topic**: AWS Identity and Access Management (IAM), User Group Policies, and Least Privilege Access Control
* **Term**: Midterm
* **Student Name**: Godwyn Neri
* **AWS Account ID**: `4198-1817-2718`
* **Assessment**: Lab 1: Introduction to AWS IAM (Vocareum Lab ID: `5756572`, Step ID: `5756573`)
* **Status**: Complete & Verified

---

## 1. Laboratory Objectives & Theoretical Overview

### 1.1 Objective
The primary objective of this laboratory exercise is to examine and configure role-based access control (RBAC) and the principle of least privilege using Amazon Web Services (AWS) Identity and Access Management (IAM). 

Specifically, this includes:
1. Exploring pre-provisioned IAM Users (`user-1`, `user-2`, `user-3`) and IAM Groups (`S3-Support`, `EC2-Support`, `EC2-Admin`).
2. Auditing attached policies:
   - **Managed Policies**: AWS-managed reusable policies (`AmazonS3ReadOnlyAccess`, `AmazonEC2ReadOnlyAccess`).
   - **Inline Policies**: Dedicated policies embedded directly into specific groups.
3. Implementing staff assignments in alignment with business requirements:
   - Assigning `user-1` to `S3-Support`.
   - Assigning `user-2` to `EC2-Support`.
   - Assigning `user-3` to `EC2-Admin`.
4. Testing real-time authorization behavior across AWS services (Amazon S3 and Amazon EC2) and validating that policy-driven access controls are strictly enforced.

---

## 2. Business Scenario & Permission Matrix

| User | Target IAM Group | Attached Policy | Permitted Operations | Restricted / Denied Operations |
| :--- | :--- | :--- | :--- | :--- |
| **user-1** | `S3-Support` | `AmazonS3ReadOnlyAccess` (Managed) | Listing and viewing Amazon S3 buckets & object contents | EC2 operations, S3 write/delete, IAM configuration |
| **user-2** | `EC2-Support` | `AmazonEC2ReadOnlyAccess` (Managed) | Describing and viewing EC2 instances, security groups, AMIs | Modifying EC2 instance state (`StopInstances`, `StartInstances`), S3 access |
| **user-3** | `EC2-Admin` | Custom Inline Policy | Describing EC2 instances, Starting instances, Stopping instances | Terminating instances, creating VPCs, modifying IAM |

---

## 3. Step-by-Step Execution Record

### Task 1: Exploration of Users, Groups, and IAM Policies
* Inspected pre-created users: `user-1`, `user-2`, `user-3`. Initially, none of the users possessed assigned policies or group memberships.
* Inspected pre-created groups:
  * `S3-Support`: Pre-attached with AWS Managed Policy `AmazonS3ReadOnlyAccess`.
  * `EC2-Support`: Pre-attached with AWS Managed Policy `AmazonEC2ReadOnlyAccess`.
  * `EC2-Admin`: Configured with an inline policy granting `ec2:Describe*`, `ec2:StartInstances`, and `ec2:StopInstances`.

### Task 2: Adding Users to Target Groups
1. Navigated to **IAM Console > User Groups > S3-Support > Users > Add users**.
   * Selected `user-1` and clicked **Add users**. Verified user count: `1`.
2. Navigated to **IAM Console > User Groups > EC2-Support > Users > Add users**.
   * Selected `user-2` and clicked **Add users**. Verified user count: `1`.
3. Navigated to **IAM Console > User Groups > EC2-Admin > Users > Add users**.
   * Selected `user-3` and clicked **Add users**. Verified user count: `1`.
4. Returned to the main **User Groups** table and confirmed that all three groups displayed `1` in the **Users** column.

### Task 3: Testing User Permissions via Sign-In URL
* **IAM Sign-In URL**: `https://419818172718.signin.aws.amazon.com/console`

#### Test A: `user-1` (S3 Support Staff)
* **Credentials**: Username `user-1` | Password `Lab-Password1`
* **S3 Console**: Successfully navigated to the Amazon S3 console. Read-only permissions allowed browsing bucket listings.
* **EC2 Console**: Attempted access to EC2 instance dashboard. Received authorization failure as expected under least privilege.

#### Test B: `user-2` (EC2 Support Specialist)
* **Credentials**: Username `user-2` | Password `Lab-Password2`
* **EC2 Console**: Successfully viewed the `LabHost` EC2 instance (`i-0de385214b6fdf5ae`, `t2.micro`, Region: `us-east-1`).
* **Instance Modification Test**: Selected `LabHost` and attempted to execute **Instance State > Stop instance**.
* **Result**: Action blocked by IAM policy with authorization failure banner:
  > `Access denied: You do not have permission to use health:DescribeEvents / StopInstances`
  *(Confirming that read-only access prevents state alteration).*

#### Test C: `user-3` (EC2 Administrator)
* **Credentials**: Username `user-3` | Password `Lab-Password3`
* **EC2 Console**: Successfully viewed `LabHost` (`i-0de385214b6fdf5ae`).
* **Instance Modification Test**: Selected `LabHost` and executed **Instance State > Stop instance**.
* **Result**: Action successfully authorized. Instance entered the `Stopping` state and completed safe shutdown.

---

## 4. Verification & Autograder Evidence

The Vocareum lab autograder evaluates CloudTrail events and IAM group topologies:
* **Task 2a**: `user-1` verified in `S3-Support` (`SUCCESS`).
* **Task 2b**: `user-2` verified in `EC2-Support` (`SUCCESS`).
* **Task 2c**: `user-3` verified in `EC2-Admin` (`SUCCESS`).
* **Task 3a**: `user-1` console authentication and S3 session verified.
* **Task 3b**: `user-2` console authentication verified.
* **Task 3c**: `user-2` unauthorized stop instance attempt recorded in CloudTrail.
* **Task 3d**: `user-3` console authentication verified.
* **Task 3e**: `user-3` authorized stop instance action recorded on `LabHost`.
