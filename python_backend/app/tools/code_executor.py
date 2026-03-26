from langchain_core.tools import tool


@tool
def execute_code(code: str, language: str = "python") -> str:
    """Execute code and return the output.

    Use this to run code examples or test solutions.
    Currently supports: python, javascript
    """
    return f"Code execution placeholder for: {language}\n{code}"


@tool
def explain_code(code: str, language: str = "python") -> str:
    """Explain what a piece of code does.

    Use this to help the candidate understand code snippets.
    """
    return f"Code explanation for: {language}\n{code}"


code_executor_tool = execute_code
