-- Native linked filters share the existing pagination revision fence.
-- Additive triggers preserve populated databases and retained archive data.
CREATE TRIGGER browse_expression_issue_relations_insert AFTER INSERT ON issue_relations BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_expression_issue_relations_update AFTER UPDATE ON issue_relations BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_expression_issue_relations_delete AFTER DELETE ON issue_relations BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_expression_release_issues_insert AFTER INSERT ON release_issues BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_expression_release_issues_update AFTER UPDATE ON release_issues BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_expression_release_issues_delete AFTER DELETE ON release_issues BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_expression_release_projects_insert AFTER INSERT ON release_projects BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_expression_release_projects_update AFTER UPDATE ON release_projects BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_expression_release_projects_delete AFTER DELETE ON release_projects BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_expression_releases_insert AFTER INSERT ON releases BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_expression_releases_update AFTER UPDATE ON releases BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_expression_releases_delete AFTER DELETE ON releases BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_expression_vector_github_pull_requests_insert AFTER INSERT ON vector_github_pull_requests BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_expression_vector_github_pull_requests_update AFTER UPDATE ON vector_github_pull_requests BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_expression_vector_github_pull_requests_delete AFTER DELETE ON vector_github_pull_requests BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_expression_vector_github_issue_links_insert AFTER INSERT ON vector_github_issue_links BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_expression_vector_github_issue_links_update AFTER UPDATE ON vector_github_issue_links BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_expression_vector_github_issue_links_delete AFTER DELETE ON vector_github_issue_links BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_expression_vector_github_repositories_insert AFTER INSERT ON vector_github_repositories BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_expression_vector_github_repositories_update AFTER UPDATE ON vector_github_repositories BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_expression_vector_github_repositories_delete AFTER DELETE ON vector_github_repositories BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_expression_issue_followers_insert AFTER INSERT ON issue_followers BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_expression_issue_followers_update AFTER UPDATE ON issue_followers BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_expression_issue_followers_delete AFTER DELETE ON issue_followers BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
