import pandas as pd
import pyodbc
import json
import os
import re
import datetime

# --- Environment Variable Setup (IMPORTANT: You need to set these in your environment) ---
# Example for setting environment variables (replace with your actual credentials and details):
# On Linux/macOS:
# export serverGFT="your_server_address"
# export databaseGFTSharePoint="your_database_name"
# export usernameSharePointGFT="your_username"
# export passwordSharePointGFT="your_password"
# export addressGFT="{ODBC Driver 17 for SQL Server}" # Or your specific ODBC driver

# On Windows (Command Prompt):
# set serverGFT="your_server_address"
# set databaseGFTSharePoint="your_database_name"
# set usernameSharePointGFT="your_username"
# set passwordSharePointGFT="your_password"
# set addressGFT="{ODBC Driver 17 for SQL Server}"

# In Python (for testing, not recommended for production):
# os.environ["serverGFT"] = "your_server_address"
# os.environ["databaseGFTSharePoint"] = "your_database_name"
# os.environ["usernameSharePointGFT"] = "your_username"
# os.environ["passwordSharePointGFT"] = "your_password"
# os.environ["addressGFT"] = "{ODBC Driver 17 for SQL Server}"


server = os.environ.get("serverGFT")
database = os.environ.get("databaseGFTSharePoint")
username = os.environ.get("usernameSharePointGFT")
password = os.environ.get("passwordSharePointGFT")
SQLaddress = os.environ.get("addressGFT")

parameter_value = "230524-0173"

SQL_INJECTION_PATTERNS = re.compile(
    r"""(?ix)  # i: case-insensitive, x: verbose (allows whitespace and comments)
    (?:
    --                     | # SQL comments
    ;                      | # Semicolon to chain commands
    /\* | # Multi-line comment start
    \*/                    | # Multi-line comment end
    '                      | # Single quote
    "                      | # Double quote
    \b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|EXEC|xp_cmdshell|benchmark|sp_)\b | # Common SQL keywords
    \b(OR|AND)\b\s*.*\b(EXISTS|SLEEP|WAITFOR\s+DELAY)\b # Boolean-based/time-based patterns
    )
    """
)

def sanitize_input(value):
    """
    Recursively sanitize input against SQL injection attempts.
    Raises ValueError if suspicious content is detected.
    """
    if isinstance(value, str):
        if SQL_INJECTION_PATTERNS.search(value):
            raise ValueError(f"Potential SQL injection detected in input: {value}")
        return value

    elif isinstance(value, (list, tuple)):
        return [sanitize_input(v) for v in value]

    elif isinstance(value, dict):
        return {k: sanitize_input(v) for k, v in value.items()}

    elif isinstance(value, (int, float, bool)) or value is None:
        return value
    elif isinstance(value, (int, float, bool, datetime.datetime, datetime.date)) or value is None:
        return value

    else:
        raise ValueError(f"Unsupported input type for SQL sanitization: {type(value)}")
def get_db_connection():
    """Establishes and returns a pyodbc database connection."""
    try:
        conn_str = (
            f"DRIVER={SQLaddress};SERVER={server};DATABASE={database};"
            f"UID={username};PWD={password};TrustServerCertificate=yes;"
        )
        # print(conn_str)
        conn = pyodbc.connect(conn_str)
        return conn
    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        print(f"Database connection error: {sqlstate} - {ex}")
        raise # Re-raise the exception for upstream handling

# --- SELECT (Existing, with minor improvements) ---
def get_onboard_all():
    """
    Fetches all records from the OnBoardRequestForm table.
    Returns a pandas DataFrame.
    """
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        print(conn, cursor)
        sql_query = """SELECT * FROM OnBoardRequestForm"""
        cursor.execute(sql_query)
        rows = cursor.fetchall()
        column_names = [column[0] for column in cursor.description]
        onboard_df = pd.DataFrame.from_records(rows, columns=column_names)
        return onboard_df
    except Exception as e:
        print(f"An error occurred during SELECT: {e}")
        return pd.DataFrame() # Return an empty DataFrame in case of error
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

def get_onboard_request_by_id(request_id: int):
    """
    Fetches a single record from the OnBoardRequestForm table by its Id.
    Returns a dictionary of the record, or None if not found.
    Uses a parameterized query for security.
    """
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Use parameterized query to prevent SQL injection
        sql_query = """SELECT * FROM OnBoardRequestForm WHERE Id = ?"""
        
        # Sanitize the ID (though for int, direct passing is usually fine with pyodbc)
        sanitized_id = sanitize_input(request_id)

        cursor.execute(sql_query, (sanitized_id,)) # Pass id as a tuple for parameterization
        
        row = cursor.fetchone() # Fetch only one row

        if row:
            column_names = [column[0] for column in cursor.description]
            # Convert the row tuple to a dictionary
            record = dict(zip(column_names, row))
            return record
        else:
            return None # Record not found

    except Exception as e:
        print(f"An error occurred fetching record by ID: {e}")
        return None
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

# --- INSERT Operation ---
def insert_onboard_request(request_data: dict):
    """
    Inserts a new onboarding request into the OnBoardRequestForm table.
    Uses parameterized query and sanitizes input.
    Assumes request_data keys match column names.
    Automatically sets CreatedAt and UpdatedAt to the current timestamp.
    'Id' column is auto-generated by the database and should not be provided.
    """
    conn = None
    cursor = None
    try:
        # Create a mutable copy and prepare data for insertion
        data_to_insert = request_data.copy()

        # Remove 'Id' if present, as it's an IDENTITY column
        data_to_insert.pop('Id', None)

        # Set CreatedAt and UpdatedAt to current timestamp
        current_time = datetime.datetime.now()
        print(current_time)
        data_to_insert['CreatedAt'] = current_time
        data_to_insert['UpdatedAt'] = current_time

        # Sanitize all values
        sanitized_data = {k: sanitize_input(v) for k, v in data_to_insert.items()}

        columns = ", ".join(sanitized_data.keys())
        placeholders = ", ".join(["?" for _ in sanitized_data]) # Use '?' for placeholders
        sql_query = f"INSERT INTO OnBoardRequestForm ({columns}) VALUES ({placeholders})"
        values = tuple(sanitized_data.values())

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(sql_query, values) # Pass values as a separate tuple for parameterization
        conn.commit()
        print("Record inserted successfully.")
        return cursor.rowcount > 0 # Return True if insertion was successful
    except ValueError as ve:
        print(f"Sanitization error: {ve}")
        return False
    except Exception as e:
        print(f"An error occurred during INSERT: {e}")
        if conn:
            conn.rollback() # Rollback in case of error
        return False
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

# --- UPDATE Operation ---
def update_onboard_request(id: int, update_data: dict):
    """
    Updates an existing onboarding request in the OnBoardRequestForm table.
    Uses parameterized query, sanitizes input, and includes row-level locking.
    Automatically sets UpdatedAt to the current timestamp.
    Assumes 'Id' is the primary key for the WHERE clause.
    """
    conn = None
    cursor = None
    try:
        # Create a mutable copy and prepare data for update
        data_to_update = update_data.copy()

        # Remove 'Id' if present in update_data, as it's used in WHERE clause
        data_to_update.pop('Id', None)

        # Set UpdatedAt to current timestamp
        data_to_update['UpdatedAt'] = datetime.datetime.now()

        # Sanitize all values
        sanitized_update_data = {k: sanitize_input(v) for k, v in data_to_update.items()}

        # Build SET clause for UPDATE query
        set_clauses = [f"{column} = ?" for column in sanitized_update_data.keys()]
        sql_query = (
            f"UPDATE OnBoardRequestForm "
            f"SET {', '.join(set_clauses)} "
            f"WHERE Id = ?" # Use 'Id' as per table schema
        )
        values = tuple(list(sanitized_update_data.values()) + [id]) # Add the ID for the WHERE clause

        conn = get_db_connection()
        cursor = conn.cursor()

        # Implement Row-Level Locking (SQL Server specific: WITH (ROWLOCK))
        # For a direct update, pyodbc handles the necessary locking automatically based on isolation level.
        # If you *must* explicitly acquire a lock *before* updating (e.g., read-modify-write pattern),
        # you'd start a transaction and use SELECT ... WITH (UPDLOCK, ROWLOCK).
        # For this direct UPDATE, we rely on the database's default transactional locking.

        cursor.execute(sql_query, values)
        conn.commit()
        print(f"Record with Id {id} updated successfully.")
        return cursor.rowcount > 0
    except ValueError as ve:
        print(f"Sanitization error: {ve}")
        return False
    except Exception as e:
        print(f"An error occurred during UPDATE: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

# --- DELETE Operation ---
def delete_onboard_request(id: int):
    """
    Deletes an onboarding request from the OnBoardRequestForm table.
    Uses parameterized query and includes row-level locking consideration.
    Assumes 'Id' is the primary key.
    """
    conn = None
    cursor = None
    try:
        # Sanitize the ID, though for int it's less critical for injection
        # but good for consistency and catching unexpected types.
        sanitized_id = sanitize_input(id)

        sql_query = "DELETE FROM OnBoardRequestForm WHERE Id = ?" # Use 'Id' as per table schema

        conn = get_db_connection()
        cursor = conn.cursor()

        # Similar to UPDATE, the DELETE statement itself will acquire necessary locks.
        # Explicit locking hints like WITH (ROWLOCK) can be added if needed for specific
        # database behavior or complex transactions.

        cursor.execute(sql_query, sanitized_id)
        conn.commit()
        print(f"Record with Id {id} deleted successfully.")
        return cursor.rowcount > 0
    except ValueError as ve:
        print(f"Sanitization error: {ve}")
        return False
    except Exception as e:
        print(f"An error occurred during DELETE: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

# --- Global In-Memory Task Database (Moved from app.py) ---
tasks_db = []

TASKS_JSON_FILE = 'tasks.json'

def load_tasks_from_json():
    """
    Loads tasks from a JSON file into the in-memory tasks_db.
    If the file does not exist or is empty, tasks_db remains empty.
    """
    global tasks_db
    if os.path.exists(TASKS_JSON_FILE) and os.path.getsize(TASKS_JSON_FILE) > 0:
        try:
            with open(TASKS_JSON_FILE, 'r') as f:
                loaded_tasks = json.load(f)
                # Clear existing in-memory tasks and load from file
                tasks_db.clear()
                tasks_db.extend(loaded_tasks)
                print(f"Loaded {len(tasks_db)} tasks from {TASKS_JSON_FILE}")
        except json.JSONDecodeError as e:
            print(f"Error decoding JSON from {TASKS_JSON_FILE}: {e}")
        except Exception as e:
            print(f"An unexpected error occurred while loading tasks from JSON: {e}")
    else:
        print(f"'{TASKS_JSON_FILE}' not found or is empty. Starting with an empty task list.")

def save_tasks_to_json():
    """
    Saves the current in-memory tasks_db to a JSON file.
    """
    try:
        with open(TASKS_JSON_FILE, 'w') as f:
            json.dump(tasks_db, f, indent=4)
        print(f"Saved {len(tasks_db)} tasks to {TASKS_JSON_FILE}")
    except Exception as e:
        print(f"Error saving tasks to {TASKS_JSON_FILE}: {e}")

# --- Helper functions for in-memory tasks (Moved from app.py, MODIFIED for string IDs) ---
def find_task_by_id(task_id: str):
    """Finds a task by its composite string ID."""
    for task in tasks_db:
        if task.get('id') == task_id:
            return task
    return None

def remove_task_by_id(task_id: str):
    """Removes a task from the in-memory database by its composite string ID."""
    global tasks_db
    initial_len = len(tasks_db)
    tasks_db = [task for task in tasks_db if task.get('id') != task_id]
    return len(tasks_db) < initial_len

def update_task_in_db_list(task_obj: dict, update_data: dict):
    """
    Updates an existing task object in the in-memory tasks_db.
    Modifies the task_obj directly and updates its 'updated_at' timestamp.
    """
    if not task_obj or not isinstance(task_obj, dict):
        print("Error: Invalid task object provided for update.")
        return False

    for key, value in update_data.items():
        if key != 'id': # Prevent updating the ID
            task_obj[key] = value
    task_obj['updated_at'] = datetime.datetime.now().isoformat()
    return True

def find_task_by_employee_and_type(employee_full_name: str, task_type: str, related_onboarding_id: int):
    """
    Finds an existing task in tasks_db for a given employee, task type, and onboarding ID.
    """
    for task in tasks_db:
        if (task.get('employee_full_name') == employee_full_name and
                task.get('task_type') == task_type and
                task.get('related_onboarding_id') == related_onboarding_id):
            return task
    return None

def add_task_to_db_list(onboarding_id: int, short_code: str, task_details: dict):
    """
    Adds a new task to the in-memory tasks_db with a composite string ID.
    """
    composite_id = f"ONB-{onboarding_id}-{short_code}"
    
    if find_task_by_id(composite_id):
        print(f"Warning: Task with ID '{composite_id}' already exists. Skipping creation.")
        return

    task_details['id'] = composite_id
    task_details.setdefault('Status', 'Open')
    task_details.setdefault('created_at', datetime.datetime.now().isoformat())
    task_details.setdefault('updated_at', datetime.datetime.now().isoformat())
    
    tasks_db.append(task_details)
    print(f"Added task to in-memory DB: {task_details['name']} (ID: {task_details['id']})")


# --- MODIFIED: Task Configuration Mapping (Moved from app.py) ---
# Now using numeric short codes as per your specific mapping.
TASK_CONFIG = {
    'EmployeeID_Requested': {
        'task_type': 'Employee ID Issuance',
        'name_prefix': 'Issue Employee ID for',
        'assignedTo': 'HR/Payroll',
        'description': 'Generate and assign unique employee identification.',
        'short_code': '1'
    },
    'PurchasingCard_Requested': {
        'task_type': 'Purchasing Card Issuance',
        'name_prefix': 'Order Purchasing Card for',
        'assignedTo': 'Finance',
        'description': 'Process application and order employee purchasing card.',
        'short_code': '2'
    },
    'GasCard_Requested': {
        'task_type': 'Gas Card Issuance',
        'name_prefix': 'Order Gas Card for',
        'assignedTo': 'Fleet Management',
        'description': 'Process application and order employee gas card.',
        'short_code': '3'
    },
    'EmailAddress_Provided': {
        'task_type': 'Email Account Setup',
        'name_prefix': 'Create Email Account for',
        'assignedTo': 'IT Department',
        'description': 'Set up new corporate email address and access.',
        'short_code': '4'
    },
    'MobilePhone_Requested': { # Added MobilePhone_Requested
        'task_type': 'Mobile Phone Issuance',
        'name_prefix': 'Order Mobile Phone for',
        'assignedTo': 'IT Department', # Assuming IT handles mobile phones
        'description': 'Process request and order corporate mobile phone.',
        'short_code': '5'
    },
    'TLCBonusEligible': {
        'task_type': 'TLC Bonus Eligibility',
        'name_prefix': 'Verify TLC Bonus Eligibility for',
        'assignedTo': 'HR/Payroll',
        'description': 'Review and confirm employee eligibility for TLC bonus program.',
        'short_code': '6' # Updated short_code
    }
}

# --- Centralized Task Management Logic (Moved from app.py) ---
def manage_onboarding_tasks(onboarding_request_data: dict):
    """
    Manages (creates or updates) tasks in the in-memory tasks_db
    based on the fields of the onboarding request.
    This function should be called after a successful insert or update
    of an OnBoardRequestForm record in the SQL database.
    """
    employee_first_name = onboarding_request_data.get('LegalFirstName', 'N/A')
    employee_last_name = onboarding_request_data.get('LegalLastName', 'N/A')
    employee_full_name = f"{employee_first_name} {employee_last_name}"
    onboarding_id = onboarding_request_data.get('Id') # This is the SQL DB ID
    manager_name = onboarding_request_data.get('Manager', 'N/A') # Capture manager name


    if onboarding_id is None:
        print("Error: Onboarding ID is missing. Cannot manage tasks.")
        return

    print(f"\n--- Managing tasks for onboarding ID {onboarding_id}, Employee: {employee_full_name} ---")

    for flag_field, config in TASK_CONFIG.items():
        # Check if the field is present and evaluate its truthiness.
        # Handle cases where value might be boolean, string "true"/"false", etc.
        is_requested = str(onboarding_request_data.get(flag_field, 'False')).lower() in ['true', '1']
        
        task_type = config['task_type']
        short_code = config['short_code']

        existing_task = find_task_by_employee_and_type(employee_full_name, task_type, onboarding_id)

        if is_requested:
            if not existing_task:
                new_task_details = {
                    'name': f"{config['name_prefix']} {employee_full_name}",
                    'description': f"{config['description']} (Onboarding ID: {onboarding_id})",
                    'task_type': task_type,
                    'assignedTo': config['assignedTo'],
                    'employee_full_name': employee_full_name,
                    'related_onboarding_id': onboarding_id,
                    'manager': manager_name}
                add_task_to_db_list(onboarding_id, short_code, new_task_details)
            elif existing_task.get('Status') in ['N/A', 'Cancelled', 'Completed']:
                update_task_in_db_list(existing_task, {'Status': 'Open', 'manager': manager_name}) # <--- UPDATED: Also update manager here
                print(f"Re-activated task '{existing_task.get('name')}' (ID: {existing_task.get('id')})")
            elif existing_task.get('manager') != manager_name: # <--- NEW: Update manager if it simply changed
                update_task_in_db_list(existing_task, {'manager': manager_name})
                print(f"Updated manager for task '{existing_task.get('name')}' (ID: {existing_task.get('id')}) to '{manager_name}'")
        else: # is_requested is False
            if existing_task and existing_task.get('Status') not in ['N/A', 'Cancelled', 'Completed']:
                update_task_in_db_list(existing_task, {'Status': 'N/A', 'description': existing_task['description'] + ' (No longer required)'})
                print(f"Marked task '{existing_task.get('name')}' (ID: {existing_task.get('id')}) as N/A")
    print("--- Task management complete ---")

def CF_SP_Emp_Detail_Search(search_term: str = None):
    """
    Calls the stored procedure CF_SP_Emp_Detail_Search to search for employee
    details by LDAP Name OR Email.

    Args:
        search_term (str): The term to search for (e.g., employee name or email).
                           This term will be passed as a parameter to the stored procedure.

    Returns:
        pandas.DataFrame: A DataFrame containing matching employee records, or empty DataFrame if none found or error.
    """
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Sanitize the search term before passing it to the stored procedure.
        # It's important to sanitize even for stored procedures to prevent issues
        # if the SP itself has dynamic SQL or other vulnerabilities.
        sanitized_term_value = sanitize_input(search_term) if search_term is not None else None

        # Use cursor.execute with the EXEC command and '?' placeholder for parameters.
        # This is a widely supported way to call stored procedures with pyodbc.
        sp_name = "[GPReporting].[dbo].[CF_SP_Emp_Detail_Search]"
        
        # The parameter must be passed as a tuple to cursor.execute, even if single.
        # If the stored procedure can handle NULL, pass (None,)
        # If it requires a default value or specific empty string for empty input, adjust here.
        parameters = (sanitized_term_value,) 

        sql_command = f"EXEC {sp_name} ?" # SQL command with a single placeholder

        print(f"Executing Stored Procedure: {sql_command}")
        print(f"Parameters: {parameters}")

        # Execute the stored procedure with the parameterized query
        cursor.execute(sql_command, parameters)

        # After execution, fetch the results
        rows = cursor.fetchall()
        column_names = [column[0] for column in cursor.description]
        
        paylocity_df = pd.DataFrame.from_records(rows, columns=column_names)
        return paylocity_df

    except ValueError as ve:
        print(f"Sanitization or parameter error: {ve}")
        return pd.DataFrame()
    except pyodbc.Error as pe:
        print(f"Database error occurred: {pe}")
        # It's helpful to print the full error details for debugging database issues
        print(f"PyODBC Error Info: {pe.args}")
        return pd.DataFrame()
    except Exception as e:
        print(f"An unexpected error occurred during Paylocity details search: {e}")
        return pd.DataFrame()
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

# --- Example Usage (How to test these functions) ---
# if __name__ == "__main__":
    # --- IMPORTANT ---
    # 1. Ensure you have the correct ODBC Driver installed on your system.
    # 2. Define your table schema for 'OnBoardRequestForm' in your database.
    # 3. Set the environment variables mentioned at the top of this script
    #    (serverGFT, databaseGFTSharePoint, usernameSharePointGFT, passwordSharePointGFT, addressGFT).

    # pd.set_option('display.max_rows', 500)
    # pd.set_option('display.max_columns', 500)
    # pd.set_option('display.width', 1000)

    # print("--- Testing SELECT ---")
    # onboard_data = get_onboard_all()
    # print("Current OnBoardRequestForm data:")
    # print(onboard_data)
    # print("-" * 30)

    # print("--- Testing INSERT ---")
    # new_request_sample = {
    #     "Type": "Full-time",
    #     "ProjectedStartDate": "2025-07-15",
    #     "LegalFirstName": "Alice",
    #     "LegalMiddleName": "Marie",
    #     "LegalLastName": "Johnson",
    #     "Suffix": "Sr.",
    #     "PositionTitle": "Project Coordinator",
    #     "Manager": "David Lee",
    #     "Department": "Operations",
    #     "Location": "Sanford",
    #     "PayRateType": "Salary",
    #     "PayRate": 75000.00,
    #     "AdditionType": "New Role",
    #     "IsReHire": False,
    #     "IsDriver": True,
    #     "EmployeeID_Requested": True,
    #     "PurchasingCard_Requested": False,
    #     "GasCard_Requested": True,
    #     "EmailAddress_Provided": "alice.johnson@example.com",
    #     "MobilePhone_Requested": True,
    #     "TLCBonusEligible": True,
    #     "NoteField": "Needs access to CRM and project management software.",
    #     "Createdby": "HR_Dept"
    #     # Id, CreatedAt, UpdatedAt are typically auto-generated by the database
    # }
    # insert_success = insert_onboard_request(new_request_sample)
    # # The following lines are repeated inserts for demonstration purposes,
    # # you might want to comment them out or change data to avoid duplicates depending on your DB constraints.
    # insert_success = insert_onboard_request(new_request_sample)
    # insert_success = insert_onboard_request(new_request_sample)
    # insert_success = insert_onboard_request(new_request_sample)
    # print(f"Insert successful: {insert_success}")
    # print("-" * 30)

    # print("--- Data After INSERT ---")
    # # After inserting, you might want to fetch all data again to see the new record(s)
    # # and then identify an 'Id' for update/delete operations.
    # onboard_data_after_insert = get_onboard_all()
    # print(onboard_data_after_insert)
    # print("-" * 30)

    # # Example UPDATE data
    # # IMPORTANT: For UPDATE, you need an existing 'Id' from your database.
    # # Replace '1' with an actual 'Id' from your 'OnBoardRequestForm' table
    # # that you verified exists after the insert or from your existing DB.
    # update_id_sample = 1 # <--- CHANGE THIS TO AN ACTUAL ID FROM YOUR DATABASE
    # update_details_sample = {
    #     "PositionTitle": "Senior Project Coordinator",
    #     "PayRate": 80000.00,
    #     "Location": "Remote",
    #     "NoteField": "Updated to reflect remote work status and promotion."
    # }
    # print(f"--- Testing UPDATE for RequestId {update_id_sample} ---")
    # update_success = update_onboard_request(update_id_sample, update_details_sample)
    # print(f"Update successful: {update_success}")
    # print("-" * 30)

    # print("--- Data After UPDATE ---")
    # print(get_onboard_all())
    # print("-" * 30)

    # # Example DELETE (assuming an ID exists)
    # # IMPORTANT: For DELETE, you need an existing 'Id' from your database.
    # # Replace '1' with an actual 'Id' from your 'OnBoardRequestForm' table.
    # delete_id_sample = 1 # <--- CHANGE THIS TO AN ACTUAL ID FROM YOUR DATABASE
    # print(f"--- Testing DELETE for RequestId {delete_id_sample} ---")
    # delete_success = delete_onboard_request(delete_id_sample)
    # print(f"Delete successful: {delete_success}")
    # print("-" * 30)

    # print("--- Data After DELETE ---")
    # print(get_onboard_all())
    # print("-" * 30)
    # print("--- Sample Run 1: Searching for 'Moulisha Reddimasu' ---")
    # search_term_1 = "Moulisha Reddimasu"
    # result_df_1 = CF_SP_Emp_Detail_Search(search_term=search_term_1)
    # print("Results for 'Moulisha Reddimasu':")
    # print(result_df_1)
    # print("\n")

    # print("--- Sample Run 2: Searching for 'Moulisha' ---")
    # search_term_2 = "Moulisha"
    # result_df_2 = CF_SP_Emp_Detail_Search(search_term=search_term_2)
    # print("Results for 'Moulisha':")
    # print(result_df_2)
    # print("\n")
    
    # print("--- Sample Run 2: Searching for 'Reddimasu' ---")
    # search_term_2 = "Reddimasu"
    # result_df_2 = CF_SP_Emp_Detail_Search(search_term=search_term_2)
    # print("Results for 'Reddimasu':")
    # print(result_df_2)
    # print("\n")

    # # Example 3: Search for a term that should not match anything
    # print("--- Sample Run 3: Searching for 'xyz_nonexistent' ---")
    # search_term_3 = "xyz_nonexistent"
    # result_df_3 = CF_SP_Emp_Detail_Search(search_term=search_term_3)
    # print("Results for 'xyz_nonexistent':")
    # print(result_df_3)
    # print("\n")
