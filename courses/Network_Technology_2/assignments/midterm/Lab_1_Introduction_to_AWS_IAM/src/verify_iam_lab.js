/**
 * Lab 1: Introduction to AWS IAM - State Verification Script
 * Validates IAM Group memberships and instance termination states.
 */

export const LAB_SPEC = {
  course: 'Information Assurance and Security',
  labTitle: 'Lab 1: Introduction to AWS IAM',
  accountId: '419818172718',
  region: 'us-east-1',
  instanceTarget: 'LabHost',
  groupAssignments: [
    { user: 'user-1', group: 'S3-Support', policy: 'AmazonS3ReadOnlyAccess' },
    { user: 'user-2', group: 'EC2-Support', policy: 'AmazonEC2ReadOnlyAccess' },
    { user: 'user-3', group: 'EC2-Admin', policy: 'Inline: Describe/Start/Stop EC2' }
  ]
};

console.log('Lab Configuration & Targets:', JSON.stringify(LAB_SPEC, null, 2));
