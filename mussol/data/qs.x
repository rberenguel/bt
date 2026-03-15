#!/bin/bash

# Define your file path
FILE="/Users/ruben/code/mussol-2/data/questions.md"

{
  cat <<'EOF'
I would like to extend the following list of FAR analogy questions with 50 more questions (obviously with no clear repeats). Be creative. They don't need to be easy:

EOF

  # Extract headings and remove the '# ' prefix
  grep '^#' "$FILE" | sed 's/^# //'

  cat <<'EOF'

The output should follow this markdown format exactly (including the asterisk for the correct answer):

# A pollinating bee, a flower
- A customer, a storefront
- A key, a lock
- *A venture capitalist, a startup*
- A predator, a prey

It needs to be in a Markdown code block (this is very important)
EOF
} | pbcopy

echo "LLM prompt copied to clipboard!"
