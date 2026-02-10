#!/usr/bin/env python3
"""
Fetch and display all PR comments and review threads from the current branch's PR.
Uses gh CLI to retrieve comments.
"""

import json
import subprocess
import sys


def run_gh_command(args):
    """Run a gh CLI command and return the JSON output."""
    try:
        result = subprocess.run(
            ["gh"] + args,
            capture_output=True,
            text=True,
            check=True
        )
        return json.loads(result.stdout) if result.stdout.strip() else None
    except subprocess.CalledProcessError as e:
        print(f"Error running gh command: {e}", file=sys.stderr)
        print(f"stderr: {e.stderr}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON: {e}", file=sys.stderr)
        sys.exit(1)


def main():
    # Get current PR number
    pr_data = run_gh_command(["pr", "view", "--json", "number,title,url"])

    if not pr_data:
        print("No PR found for current branch")
        sys.exit(1)

    pr_number = pr_data["number"]
    print(f"═══════════════════════════════════════════════════════════════")
    print(f"PR #{pr_number}: {pr_data['title']}")
    print(f"URL: {pr_data['url']}")
    print(f"═══════════════════════════════════════════════════════════════\n")

    # Get all review comments
    reviews = run_gh_command([
        "pr", "view", str(pr_number),
        "--json", "reviews",
        "--jq", ".reviews"
    ])

    # Get all issue comments (general PR comments)
    comments = run_gh_command([
        "pr", "view", str(pr_number),
        "--json", "comments",
        "--jq", ".comments"
    ])

    # Collect all review threads
    review_threads = []
    if reviews:
        for review in reviews:
            if review.get("body") and review["body"].strip():
                review_threads.append({
                    "type": "review",
                    "author": review.get("author", {}).get("login", "unknown"),
                    "state": review.get("state", ""),
                    "body": review["body"],
                    "path": None,
                    "line": None
                })

    # Get review comments (line-specific comments)
    review_comments = run_gh_command([
        "api",
        f"repos/{{owner}}/{{repo}}/pulls/{pr_number}/comments",
        "--jq", "."
    ])

    if review_comments:
        for comment in review_comments:
            review_threads.append({
                "type": "review_comment",
                "author": comment.get("user", {}).get("login", "unknown"),
                "state": comment.get("state", ""),
                "body": comment.get("body", ""),
                "path": comment.get("path"),
                "line": comment.get("line") or comment.get("original_line"),
                "diff_hunk": comment.get("diff_hunk", "")
            })

    # Add general PR comments
    if comments:
        for comment in comments:
            review_threads.append({
                "type": "comment",
                "author": comment.get("author", {}).get("login", "unknown"),
                "state": None,
                "body": comment.get("body", ""),
                "path": None,
                "line": None
            })

    if not review_threads:
        print("✓ No comments or review threads found on this PR")
        return

    # Display all threads with numbering
    print(f"Found {len(review_threads)} comment(s) / review thread(s):\n")

    for i, thread in enumerate(review_threads, 1):
        print(f"─────────────────────────────────────────────────────────────")
        print(f"[{i}] {thread['type'].upper()} by {thread['author']}")

        if thread['path']:
            location = f"{thread['path']}"
            if thread['line']:
                location += f":{thread['line']}"
            print(f"    Location: {location}")

        if thread['state']:
            print(f"    State: {thread['state']}")

        if thread.get('diff_hunk'):
            print(f"    Context:\n{thread['diff_hunk']}")

        print(f"\n{thread['body']}\n")

    print(f"═══════════════════════════════════════════════════════════════")
    print(f"Total: {len(review_threads)} thread(s)")


if __name__ == "__main__":
    main()
