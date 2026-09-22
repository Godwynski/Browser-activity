# 04 Quiz 1: Cloud Security (Midterm)

- **Course:** Network Technology 2 (IT2607)
- **Module:** Cloud Security (Midterm)
- **URL:** [https://elms.sti.edu/student_quiz_assignment/show/59849811](https://elms.sti.edu/student_quiz_assignment/show/59849811)
- **Total Points:** 15 / 15
- **Status:** All questions answered; currently at "End of quiz" review screen. Not submitted yet.

---

## Questions & Selected Responses

### Question 1
**Question:** Which of the following is most appropriate when an AWS service needs temporary access to another AWS resource without storing permanent credentials?  
**Selected Response:** `Assign an IAM role that the service can assume.`  
**Explanation / Handout Reference:** Handout p. 3: IAM roles provide permissions without requiring permanent credentials. A role can be assumed by AWS services to interact with other resources safely.

---

### Question 2
**Question:** This is the security responsibility handled by AWS under the shared responsibility model.  
**Selected Response:** `Protecting the underlying cloud infrastructure`  
**Explanation / Handout Reference:** Handout p. 1: AWS is responsible for security *of* the cloud, which includes hardware, software, facilities, and the underlying cloud infrastructure.

---

### Question 3
**Question:** Which of the following practices follows the principle of least privilege?  
**Selected Response:** `Granting only permissions required for assigned tasks`  
**Explanation / Handout Reference:** Handout p. 2: The principle of least privilege means granting only the permissions necessary to perform required tasks.

---

### Question 4
**Question:** Which of the following should be used to protect data while it is moving between systems or network locations?  
**Selected Response:** `TLS or SSL encryption`  
**Explanation / Handout Reference:** Handout p. 6: Protecting Data in Transit uses Transport Layer Security (TLS) and Secure Sockets Layer (SSL) to encrypt data moving across networks.

---

### Question 5
**Question:** Which of the following is a recommended practice for protecting the AWS account root user?  
**Selected Response:** `Enable multi-factor authentication for the root user.`  
**Explanation / Handout Reference:** Handout p. 3: Essential best practice to protect the root account is enabling Multi-Factor Authentication (MFA) and never using root for routine tasks.

---

### Question 6
**Question:** Which AWS service should an organization use to assess resource configurations against established requirements and identify resources that do not meet the expected configuration?  
**Selected Response:** `AWS Config`  
**Explanation / Handout Reference:** Handout p. 7: AWS Config assesses, audits, and evaluates resource configurations against established requirements.

---

### Question 7
**Question:** Which of the following IAM components is most appropriate when several users performing similar job functions require the same permissions?  
**Selected Response:** `IAM group`  
**Explanation / Handout Reference:** Handout p. 3: IAM groups simplify permission management when multiple users require similar access.

---

### Question 8
**Question:** Which of the following is a customer responsibility when using Amazon EC2?  
**Selected Response:** `Installing guest operating system security patches`  
**Explanation / Handout Reference:** Handout p. 1: For IaaS services like EC2, the customer is responsible for managing the guest OS, updates, and security patches.

---

### Question 9
**Question:** Which of the following correctly describes a Service Control Policy (SCP)?  
**Selected Response:** `It establishes boundaries for permissions within AWS Organizations.`  
**Explanation / Handout Reference:** Handout p. 4-5: Service Control Policies (SCPs) do not grant permissions directly; they establish boundaries for permissions across accounts in AWS Organizations.

---

### Question 10
**Question:** It is the AWS service used to securely control access to AWS resources.  
**Selected Response:** `AWS Identity and Access Management (IAM)`  
**Explanation / Handout Reference:** Handout p. 2: AWS IAM is the service used to securely control authentication and authorization for AWS resources.

---

### Question 11
**Question:** Which AWS service records actions performed through AWS services and provides information about account activity?  
**Selected Response:** `AWS CloudTrail`  
**Explanation / Handout Reference:** Handout p. 4: AWS CloudTrail records actions taken across AWS services for auditing and visibility.

---

### Question 12
**Question:** Which AWS service is most appropriate for centrally managing multiple AWS accounts and arranging them into organizational units?  
**Selected Response:** `AWS Organizations`  
**Explanation / Handout Reference:** Handout p. 4: AWS Organizations enables centralized account management and structure into Organizational Units (OUs).

---

### Question 13
**Question:** Which AWS service should an organization use to centrally create and manage cryptographic keys for protecting data?  
**Selected Response:** `AWS Key Management Service (AWS KMS)`  
**Explanation / Handout Reference:** Handout p. 5: AWS KMS is used to create and manage cryptographic keys for data encryption.

---

### Question 14
**Question:** It is the AWS model that divides security responsibilities between AWS and the customer.  
**Selected Response:** `AWS Shared Responsibility Model`  
**Explanation / Handout Reference:** Handout p. 1: The AWS Shared Responsibility Model specifies security of the cloud (AWS) vs security in the cloud (customer).

---

### Question 15
**Question:** Which of the following occurs when an IAM policy contains an explicit deny for an action that another policy allows?  
**Selected Response:** `The explicit deny overrides the allow.`  
**Explanation / Handout Reference:** Handout p. 3: In AWS IAM policy evaluation, an explicit deny always overrides an allow.
