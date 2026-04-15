export const ACCOUNTS_LIST_QUERY = `
  query AccountsList {
    actor {
      accounts {
        id
        name
      }
    }
  }
`;

export const ENTITY_SEARCH_QUERY = `
  query EntitySearch($query: String!, $cursor: String, $limit: Int) {
    actor {
      entitySearch(query: $query, options: { limit: $limit }) {
        results(cursor: $cursor) {
          entities {
            guid
            name
            entityType
            domain
            type
            reporting
            tags {
              key
              values
            }
            ... on ApmApplicationEntity {
              language
              applicationId
            }
          }
          nextCursor
        }
        count
      }
    }
  }
`;

export const ENTITY_GET_QUERY = `
  query EntityGet($guid: EntityGuid!) {
    actor {
      entity(guid: $guid) {
        guid
        name
        entityType
        domain
        type
        reporting
        tags {
          key
          values
        }
        ... on ApmApplicationEntity {
          language
          applicationId
          settings {
            appApdexThreshold
          }
        }
        ... on BrowserApplicationEntity {
          applicationId
        }
        ... on SyntheticMonitorEntity {
          monitorId
          monitorType
          period
          status
        }
        ... on DashboardEntity {
          createdAt
          updatedAt
          permissions
        }
      }
    }
  }
`;

export const ENTITY_TAGS_ADD_MUTATION = `
  mutation TagsAdd($guid: EntityGuid!, $tags: [TaggingTagInput!]!) {
    taggingAddTagsToEntity(guid: $guid, tags: $tags) {
      errors {
        message
        type
      }
    }
  }
`;

export const ENTITY_TAGS_DELETE_MUTATION = `
  mutation TagsDelete($guid: EntityGuid!, $tagKeys: [String!]!) {
    taggingDeleteTagFromEntity(guid: $guid, tagKeys: $tagKeys) {
      errors {
        message
        type
      }
    }
  }
`;

export const ENTITY_TAGS_REPLACE_MUTATION = `
  mutation TagsReplace($guid: EntityGuid!, $tags: [TaggingTagInput!]!) {
    taggingReplaceTagsOnEntity(guid: $guid, tags: $tags) {
      errors {
        message
        type
      }
    }
  }
`;

export const NRQL_QUERY = `
  query NrqlQuery($accountId: Int!, $query: Nrql!, $timeout: Seconds) {
    actor {
      account(id: $accountId) {
        nrql(query: $query, timeout: $timeout) {
          results
          metadata {
            facets
            eventTypes
            timeWindow {
              begin
              end
              since
              until
            }
          }
          totalResult
        }
      }
    }
  }
`;

export const DEPLOYMENT_RECORD_MUTATION = `
  mutation RecordDeployment($deployment: ChangeTrackingDeploymentInput!) {
    changeTrackingCreateDeployment(deployment: $deployment) {
      deploymentId
      entityGuid
      changelog
      description
      deploymentType
      groupId
      timestamp
      user
      version
    }
  }
`;

export const DEPLOYMENT_LIST_QUERY = `
  query DeploymentList($guid: EntityGuid!, $limit: Int) {
    actor {
      entity(guid: $guid) {
        ... on ApmApplicationEntity {
          deploymentSearch(pagination: { limit: $limit }) {
            results {
              deploymentId
              version
              changelog
              description
              deploymentType
              timestamp
              user
            }
          }
        }
      }
    }
  }
`;
