# Lab 1: Introduction to AWS IAM

AWS Identity and Access Management (IAM) is a web service that enables Amazon Web Services (AWS) customers to manage users and user permissions in AWS. With IAM, you can centrally manage users, security credentials such as access keys, and permissions that control which AWS resources users can access.

## Lab overview and objectives
This lab demonstrates:
* Exploring pre-created IAM Users and Groups
* Inspecting IAM policies as applied to the pre-created groups
* Following a real-world scenario, adding users to groups with specific capabilities enabled
* Locating and using the IAM sign-in URL
* Experimenting with the effects of policies on service access

## Business Scenario
Your company is growing its use of Amazon Web Services, and is using many Amazon EC2 instances and a great deal of Amazon S3 storage. You wish to give access to new staff depending upon their job function:

| User | In Group | Permissions |
| :--- | :--- | :--- |
| **user-1** | `S3-Support` | Read-Only access to Amazon S3 (`AmazonS3ReadOnlyAccess`) |
| **user-2** | `EC2-Support` | Read-Only access to Amazon EC2 (`AmazonEC2ReadOnlyAccess`) |
| **user-3** | `EC2-Admin` | View, Start and Stop Amazon EC2 instances |

## Required Tasks Summary
### Task 1: Explore the Users and Groups
- IAM Users: `user-1`, `user-2`, `user-3`
- IAM Groups: `EC2-Admin`, `EC2-Support`, `S3-Support`
- Inspect permissions:
  - `EC2-Support` -> `AmazonEC2ReadOnlyAccess`
  - `S3-Support` -> `AmazonS3ReadOnlyAccess`
  - `EC2-Admin` -> Inline Policy (allows Describe, StartInstances, StopInstances)

### Task 2: Add Users to Groups
1. Add `user-1` to `S3-Support`
2. Add `user-2` to `EC2-Support`
3. Add `user-3` to `EC2-Admin`
4. Verify each group has 1 user.

### Task 3: Sign-In and Test Users
1. Copy IAM users sign-in link: `https://<account-id>.signin.aws.amazon.com/console`
2. Test `user-1` (Password: `Lab-Password1`):
   - Access S3 console -> Can list buckets
   - Access EC2 console -> Unauthorized
3. Test `user-2` (Password: `Lab-Password2`):
   - Access EC2 console -> Can view instances (`LabHost`), but unauthorized to Stop instance
   - Access S3 console -> Unauthorized
4. Test `user-3` (Password: `Lab-Password3`):
   - Access EC2 console -> Can view instance `LabHost`
   - Stop instance `LabHost` -> Status changes to `stopping` / `stopped`
5. Submit Lab in Vocareum for full grading credit.
