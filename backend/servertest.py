import pandas as pd
import pyodbc
import json
import os
import re
import datetime
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import padding
import base64 # For encoding binary data to string
import hashlib # For key derivation from passphrase
import traceback
from twilio.rest import Client
import random
import string


server = os.environ.get("serverGFT")
database = os.environ.get("databaseGFTSharePoint")
username = os.environ.get("usernameSharePointGFT")
password = os.environ.get("passwordSharePointGFT")
SQLaddress = os.environ.get("addressGFT")
ENCRYPTION_PASSPHRASE = os.environ.get("onboardPasscode")
TWILIO_ACCOUNT_SID = os.environ.get("account_sid")
TWILIO_AUTH_TOKEN = os.environ.get("auth_token")

def derive_key_from_passphrase(passphrase: str, salt: bytes = b'static_salt_for_app_key_derivation') -> bytes:
    """Derives a 256-bit key from a passphrase using PBKDF2 (for demonstration)."""
    # Using 100,000 iterations for PBKDF2. Increase in production if needed.
    kdf = hashlib.pbkdf2_hmac('sha256', passphrase.encode('utf-8'), salt, 100000)
    return kdf[:32] # Use first 32 bytes for AES-256

AES_KEY = derive_key_from_passphrase(ENCRYPTION_PASSPHRASE)

def encrypt_aes_cbc(value: str) -> str:
    """
    Encrypts a string value using AES-256-CBC with a randomly generated IV.
    Returns a base64-encoded string combining IV and ciphertext.
    Format: base64(IV + Ciphertext)
    """
    if value is None:
        return None
    # Ensure value is a string before encoding to bytes
    value_bytes = str(value).encode('utf-8')

    # Generate a random 16-byte IV for CBC mode
    iv = os.urandom(16)
    cipher = Cipher(algorithms.AES(AES_KEY), modes.CBC(iv), backend=default_backend())
    encryptor = cipher.encryptor()

    # PKCS7 padding for AES
    padder = padding.PKCS7(algorithms.AES.block_size).padder()
    padded_data = padder.update(value_bytes) + padder.finalize()

    ciphertext = encryptor.update(padded_data) + encryptor.finalize()

    # Combine IV and ciphertext, then base64 encode for storage
    return base64.b64encode(iv + ciphertext).decode('utf-8')

def decrypt_aes_cbc(encrypted_b64_value: str):
    """
    Decrypts a base64-encoded string (IV + ciphertext) using AES-256-CBC.
    Returns the original string value, or None if input is None or decryption fails.
    """
    if encrypted_b64_value is None:
        return None
    try:
        # Check if the value is already decrypted or not a string (e.g., if a number was somehow passed)
        if not isinstance(encrypted_b64_value, str):
            # If it's not a string, assume it's already decrypted or not encrypted.
            # You might want more robust error handling here.
            return encrypted_b64_value
            
        decoded_data = base64.b64decode(encrypted_b64_value)
        # Extract IV (first 16 bytes) and ciphertext
        iv = decoded_data[:16]
        ciphertext = decoded_data[16:]

        cipher = Cipher(algorithms.AES(AES_KEY), modes.CBC(iv), backend=default_backend())
        decryptor = cipher.decryptor()

        padded_plaintext = decryptor.update(ciphertext) + decryptor.finalize()

        # Unpad the plaintext
        unpadder = padding.PKCS7(algorithms.AES.block_size).unpadder()
        plaintext_bytes = unpadder.update(padded_plaintext) + unpadder.finalize()

        return plaintext_bytes.decode('utf-8')
    except Exception as e:
        print(f"Decryption error (AES-CBC) for value: {encrypted_b64_value} - {e}")
        traceback.print_exc()
        return None # Or raise an error, depending on desired behavior

# --- Environment Variable Setup (IMPORTANT: You need to set these in your environment) ---
# Example for setting environment variables (replace with your actual credentials and details):
# On Linux/macOS:
# export serverGFT="your_server_address"
# export databaseGFTSharePoint="your_database_name"
# export usernameSharePointGFT="your_username"
# export passwordSharePointGFT="your_password"
# export addressGFT="{ODBC Driver 17 for SQL Server}" # Or your specific ODBC driver

# On Windows (Command Prompt):
# setx serverGFT="your_server_address" /M
# setx databaseGFTSharePoint="your_database_name" /M
# setx usernameSharePointGFT="your_username" /M
# setx passwordSharePointGFT="your_password" /M
# setx addressGFT="{ODBC Driver 17 for SQL Server}" /M

# In Python (for testing, not recommended for production):
# os.environ["serverGFT"] = "your_server_address"
# os.environ["databaseGFTSharePoint"] = "your_database_name"
# os.environ["usernameSharePointGFT"] = "your_username"
# os.environ["passwordSharePointGFT"] = "your_password"
# os.environ["addressGFT"] = "{ODBC Driver 17 for SQL Server}"

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


def manage_EmployeeStatusChanges(request_data: dict):
    """
    Manages EmployeeStatusChanges records (INSERT or UPDATE).
    Encrypts 'CurrentRate_E' and 'NewRate_E' columns before database operations.

    Args:
        request_data (dict): A dictionary containing the data for the record.
                             If 'SubmissionID' is present, it attempts an UPDATE.
                             Otherwise, it performs an INSERT.

    Returns:
        bool: True if the operation was successful, False otherwise.
        str: A message indicating the outcome or error.
    """
    conn = None
    cursor = None
    operation_type = "UPDATE" if "SubmissionID" in request_data and request_data["SubmissionID"] is not None else "INSERT"

    # Create a mutable copy of request_data to modify for encryption
    processed_data = request_data.copy()

    # --- ENCRYPT SENSITIVE COLUMNS ---
    columns_to_encrypt = ["CurrentRate_E", "NewRate_E"]
    for col in columns_to_encrypt:
        if col in processed_data and processed_data[col] is not None:
            try:
                processed_data[col] = encrypt_aes_cbc(processed_data[col])
            except Exception as e:
                print(f"Error encrypting column {col}: {e}")
                return False, f"Error encrypting data for {col}."

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        if operation_type == "INSERT":
            # Exclude SubmissionID and SubmittedAt (as they are auto-generated/defaulted)
            cols_to_insert = [col for col in processed_data.keys() if col not in ["SubmissionID", "SubmittedAt"]]
            values_placeholder = ", ".join(["?"] * len(cols_to_insert))
            column_names = ", ".join([f"[{col}]" for col in cols_to_insert]) # Enclose column names in brackets for SQL Server

            sql_query = f"""
            INSERT INTO [dbo].[EmployeeStatusChanges] ({column_names})
            VALUES ({values_placeholder})
            """
            values = tuple(processed_data[col] for col in cols_to_insert)
            print(f"Executing INSERT: {sql_query} with values: {values}")
            cursor.execute(sql_query, values)
            conn.commit()
            return True, "Record inserted successfully."

        elif operation_type == "UPDATE":
            submission_id = processed_data.pop("SubmissionID") # Remove ID from data to update
            # SubmittedAt is usually not updated, but include if needed
            cols_to_update = [col for col in processed_data.keys() if col not in ["SubmittedAt"]]
            set_clauses = ", ".join([f"[{col}] = ?" for col in cols_to_update]) # Enclose column names in brackets

            sql_query = f"""
            UPDATE [dbo].[EmployeeStatusChanges]
            SET {set_clauses}
            WHERE [SubmissionID] = ?
            """
            values = tuple(processed_data[col] for col in cols_to_update) + (submission_id,)
            print(f"Executing UPDATE: {sql_query} with values: {values}")
            cursor.execute(sql_query, values)
            conn.commit()

            # Check if any row was actually updated
            if cursor.rowcount == 0:
                return False, f"No record found with SubmissionID: {submission_id} to update."
            return True, f"Record with SubmissionID {submission_id} updated successfully."

    except Exception as e:
        print(f"An error occurred during {operation_type} operation: {e}")
        traceback.print_exc() # Log the full traceback for debugging
        return False, f"Error during {operation_type} operation: {e}"
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

# --- onboard (Existing, with minor improvements) ---
def get_onboard_all():
    """
    Fetches all records from the OnBoardRequestForm table.
    Decrypts 'PayRate' in Python after fetching.
    Skips rows where decryption fails.
    Returns a pandas DataFrame.
    """
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        sql_query = "SELECT * FROM OnBoardRequestForm"
        cursor.execute(sql_query)
        rows = cursor.fetchall()
        column_names = [column[0] for column in cursor.description]
        onboard_df = pd.DataFrame.from_records(rows, columns=column_names)

        # Safe decryption of PayRate
        if 'PayRate' in onboard_df.columns:
            def safe_decrypt(x):
                try:
                    return decrypt_aes_cbc(str(x)) if x is not None else None
                except Exception:
                    return None  # Will drop this row later

            onboard_df['PayRate'] = onboard_df['PayRate'].apply(safe_decrypt)
            onboard_df = onboard_df[onboard_df['PayRate'].notna()]  # Drop rows where decryption failed
            onboard_df['PayRate'] = pd.to_numeric(onboard_df['PayRate'], errors='coerce')

        return onboard_df

    except Exception as e:
        print(f"An error occurred during SELECT ALL (with decryption): {e}")
        traceback.print_exc()
        return pd.DataFrame()  # Empty DataFrame on failure

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

# --- GET BY ID Operation (with PayRate Decryption in Python) ---
def get_onboard_request_by_id(request_id: int):
    """
    Fetches a single record from the OnBoardRequestForm table by its Id.
    Decrypts 'PayRate' in Python after fetching.
    If 'PayRate' is None/empty after decryption, it is dropped from the record.
    Returns a dictionary of the record, or None if not found.
    Uses a parameterized query for security.
    """
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        sql_query = """SELECT * FROM OnBoardRequestForm WHERE Id = ?"""
        
        sanitized_id = sanitize_input(request_id)

        cursor.execute(sql_query, (sanitized_id,))
        
        row = cursor.fetchone()

        if row:
            column_names = [column[0] for column in cursor.description]
            record = dict(zip(column_names, row))
            
            # Decrypt 'PayRate' in the record
            if 'PayRate' in record:
                decrypted_value_str = decrypt_aes_cbc(str(record['PayRate']))
                
                # Check if decrypted_value_str is None or empty after decryption
                if decrypted_value_str is None or decrypted_value_str == '':
                    del record['PayRate'] # Drop the key if empty
                    print(f"PayRate for record ID {request_id} was empty after decryption and has been dropped.")
                else:
                    record['PayRate'] = decrypted_value_str
                    # Convert back to numeric if appropriate
                    try:
                        # Attempt conversion to float, if that fails, try int, otherwise keep as string
                        if '.' in record['PayRate']:
                            record['PayRate'] = float(record['PayRate'])
                        else:
                            record['PayRate'] = int(record['PayRate'])
                    except (ValueError, TypeError):
                        pass # Keep as string if conversion fails
            return record
        else:
            return None

    except Exception as e:
        print(f"An error occurred fetching record by ID (with decryption): {e}")
        traceback.print_exc()
        return None
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

def insert_onboard_request(request_data: dict):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        request_data["UpdatedAt"] = datetime.datetime.now()
        request_data["CreatedAt"] = datetime.datetime.now()

        # Sanitize and optionally encrypt sensitive fields
        sanitized_data = {}
        for k, v in request_data.items():
            if k.lower() == "payrate":  # adjust field name if needed
                sanitized_data[k] = encrypt_aes_cbc(str(v))
            else:
                sanitized_data[k] = sanitize_input(v)

        columns = ', '.join(f"[{k}]" for k in sanitized_data.keys())
        placeholders = ', '.join(['?' for _ in sanitized_data])
        values = list(sanitized_data.values())

        insert_query = f"""
        INSERT INTO OnBoardRequestForm ({columns})
        OUTPUT INSERTED.Id
        VALUES ({placeholders})
        """
        cursor.execute(insert_query, values)
        new_id = cursor.fetchone()[0]
        conn.commit()
        return new_id

    except Exception as e:
        print(f"[INSERT] Error: {e}")
        traceback.print_exc()
        return None
    finally:
        cursor.close()
        conn.close()

def update_onboard_request(id: int, update_data: dict):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        update_data.pop("Id", None)
        update_data["UpdatedAt"] = datetime.datetime.now()
        sanitized_data = {}
        for k, v in update_data.items():
            if k.lower() == "payrate":
                sanitized_data[k] = encrypt_aes_cbc(str(v))
            else:
                sanitized_data[k] = sanitize_input(v)

        set_clause = ', '.join([f"[{key}] = ?" for key in sanitized_data.keys()])
        values = list(sanitized_data.values())
        values.append(id)

        update_query = f"""
        UPDATE OnBoardRequestForm
        SET {set_clause}
        WHERE Id = ?
        """

        cursor.execute(update_query, values)
        conn.commit()
        manage_tasks_after_submission_update(id, update_data)
        return cursor.rowcount > 0

    except Exception as e:
        print(f"[UPDATE] Error: {e}")
        traceback.print_exc()
        return False
    finally:
        cursor.close()
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
global tasks_db
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
    """
    Removes a task from the in-memory database by its composite string ID.
    Sends an SMS notification if the task is found and removed.
    """
    global tasks_db
    task_to_remove = find_task_by_id(task_id) # Find the task before removing it
    
    initial_len = len(tasks_db)
    tasks_db = [task for task in tasks_db if task.get('id') != task_id]
    
    if len(tasks_db) < initial_len:
        print(f"Task with ID '{task_id}' removed from in-memory DB.")
        save_tasks_to_json() # Save changes immediately

        # --- NEW SMS SENDING FOR DELETION ---
        if task_to_remove:
            task_type = task_to_remove.get('task_type')
            config = next((c for k, c in TASK_CONFIG.items() if c['task_type'] == task_type), None)
            
            if config and 'to_phone' in config and 'sms_delete_message_template' in config:
                sms_message = config['sms_delete_message_template'].format(
                    employee_full_name=task_to_remove.get('employee_full_name', 'N/A'),
                    onboarding_id=task_to_remove.get('related_onboarding_id', 'N/A'),
                    task_name=task_to_remove.get('name', 'N/A')
                )
                send_sms_notification(config['to_phone'], sms_message)
                print(f"ACTION: SMS SENT for deleted task '{task_to_remove.get('name')}' (ID: {task_id}).")
        return True
    return False

def update_task_in_db_list(task_obj: dict, update_data: dict): #
    if not task_obj or not isinstance(task_obj, dict): #
        print("Error: Invalid task object provided for update.") #
        return False #

    old_status = task_obj.get('Status') #

    for key, value in update_data.items(): #
        if key != 'id': # Prevent updating the ID
            task_obj[key] = value #
    task_obj['updated_at'] = datetime.datetime.now().isoformat() #
    print(f"Task '{task_obj.get('name')}' (ID: {task_obj.get('id')}) updated in-memory.") #

    new_status = task_obj.get('Status') #

    if old_status != 'Cancelled' and new_status == 'Cancelled': #
        task_type = task_obj.get('task_type') #
        config = next((c for k, c in TASK_CONFIG.items() if c['task_type'] == task_type), None) #

        if config and 'to_phone' in config and 'sms_delete_message_template' in config: #
            sms_message = config['sms_delete_message_template'].format( #
                employee_full_name=task_obj.get('employee_full_name', 'N/A'), #
                onboarding_id=task_obj.get('related_onboarding_id', 'N/A'), #
                task_name=task_obj.get('name', 'N/A') #
            )
            send_sms_notification(config['to_phone'], sms_message) #
            print(f"ACTION: SMS SENT for cancelled task '{task_obj.get('name')}' (ID: {task_obj.get('id')}).") #

    save_tasks_to_json() # Save changes immediately
    return True #

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
    Sends an SMS for new task creation.
    """
    composite_id = f"ONB-{onboarding_id}-{short_code}"
    
    if find_task_by_id(composite_id):
        print(f"Warning: Task with ID '{composite_id}' already exists. Skipping creation.")
        return

    task_details['id'] = composite_id
    task_details.setdefault('Status', 'Open') # Default to Open
    task_details.setdefault('created_at', datetime.datetime.now().isoformat())
    task_details.setdefault('updated_at', datetime.datetime.now().isoformat())
    
    tasks_db.append(task_details)
    print(f"Added task to in-memory DB: {task_details['name']} (ID: {task_details['id']})")
    
    # --- SMS SENDING FOR NEW TASK (similar to manage_onboarding_tasks logic) ---
    task_type = task_details.get('task_type')
    config = next((c for k, c in TASK_CONFIG.items() if c['task_type'] == task_type), None)

    if config and 'to_phone' in config and 'sms_message_template' in config:
        # Check if the task is being added with an 'Open' status, or other statuses that warrant a "new task" SMS
        if task_details.get('Status') == 'Open': # Only send new task SMS if truly 'Open'
            sms_message = config['sms_message_template'].format(
                employee_full_name=task_details.get('employee_full_name', 'N/A'), 
                onboarding_id=task_details.get('related_onboarding_id', 'N/A'),
                manager=task_details.get('manager', 'N/A')
            )
            send_sms_notification(config['to_phone'], sms_message)
            print(f"ACTION: SMS SENT for new task '{task_details.get('name')}' (ID: {task_details.get('id')}).")
    save_tasks_to_json()


# --- MODIFIED: Task Configuration Mapping (Moved from app.py) ---
# Now using numeric short codes as per your specific mapping.
def send_sms_notification(to_phone_number: str, message_body: str):
    """
    Sends an SMS notification using Twilio.
    """
    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN:
        print("ERROR: Twilio credentials not fully set. Cannot send SMS.")
        return False

    client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    try:
        message = client.messages.create(
            body=message_body,
            from_=16893004727,
            to=to_phone_number
        )
        print(f"Twilio SMS sent to {to_phone_number}. Message SID: {message.sid}")
        return True
    except Exception as e:
        print(f"ERROR: Failed to send Twilio SMS to {to_phone_number}: {e}")
        traceback.print_exc()
        return False

# --- MODIFIED: Task Configuration Mapping (All tasks now include specific email and phone) ---
# Now using numeric short codes as per your specific mapping.
TASK_CONFIG = {
    'EmployeeID_Requested': {
        'task_type': 'Employee ID Issuance',
        'name_prefix': 'Issue Employee ID for',
        'assignedTo': 'HR/Payroll',
        'description': 'Generate and assign unique employee identification.',
        'short_code': '1',
        'to_email': 'yuanchichung@guardianfueltech.com',
        'to_phone': '19046767222', # ADDED
        'email_subject': 'Task: Employee ID Issuance for {employee_full_name}',
        'email_body_template': 'Please issue an Employee ID for {employee_full_name} (Onboarding ID: {onboarding_id}). Manager: {manager}.',
        'sms_message_template': 'Task: Employee ID for {employee_full_name} (ID: {onboarding_id}). Manager: {manager}.' # ADDED
    },
    'PurchasingCard_Requested': {
        'task_type': 'Purchasing Card Issuance',
        'name_prefix': 'Order Purchasing Card for',
        'assignedTo': 'Finance',
        'description': 'Process application and order employee purchasing card.',
        'short_code': '2',
        'to_email': 'yuanchichung@guardianfueltech.com',
        'to_phone': '19046767222', # ADDED
        'email_subject': 'Task: Purchasing Card Request for {employee_full_name}',
        'email_body_template': 'Please order a Purchasing Card for {employee_full_name} (Onboarding ID: {onboarding_id}). Manager: {manager}.',
        'sms_message_template': 'Task: Purchasing Card for {employee_full_name} (ID: {onboarding_id}). Manager: {manager}.' # ADDED
    },
    'GasCard_Requested': {
        'task_type': 'Gas Card Issuance',
        'name_prefix': 'Order Gas Card for',
        'assignedTo': 'Fleet Management',
        'description': 'Process application and order employee gas card.',
        'short_code': '3',
        'to_email': 'yuanchichung@guardianfueltech.com',
        'to_phone': '19046767222', # ADDED
        'email_subject': 'Task: Gas Card Request for {employee_full_name}',
        'email_body_template': 'Please order a Gas Card for {employee_full_name} (Onboarding ID: {onboarding_id}). Manager: {manager}.',
        'sms_message_template': 'Task: Gas Card for {employee_full_name} (ID: {onboarding_id}). Manager: {manager}.' # ADDED
    },
    'EmailAddress_Provided': {
        'task_type': 'Email Account Setup',
        'name_prefix': 'Create Email Account for',
        'assignedTo': 'IT Department',
        'description': 'Set up new corporate email address and access.',
        'short_code': '4',
        'to_email': 'yuanchichung@guardianfueltech.com',
        'to_phone': '19046767222', # ADDED
        'email_subject': 'Task: New Employee Email Account Setup Request for {employee_full_name}',
        'email_body_template': 'Please create an email account for {employee_full_name} (Onboarding ID: {onboarding_id}). Manager: {manager}.',
        'sms_message_template': 'Task: Email Account for {employee_full_name} (ID: {onboarding_id}). Manager: {manager}.' # ADDED
    },
    'MobilePhone_Requested': { 
        'task_type': 'Mobile Phone Issuance',
        'name_prefix': 'Order Mobile Phone for',
        'assignedTo': 'IT Department', 
        'description': 'Process request and order corporate mobile phone.',
        'short_code': '5',
        'to_email': 'yuanchichung@guardianfueltech.com',
        'to_phone': '19046767222', # ADDED
        'email_subject': 'Task: Mobile Phone Request for {employee_full_name}',
        'email_body_template': 'Please order a Mobile Phone for {employee_full_name} (Onboarding ID: {onboarding_id}). Manager: {manager}.',
        'sms_message_template': 'Task: Mobile Phone for {employee_full_name} (ID: {onboarding_id}). Manager: {manager}.' # ADDED
    },
    'TLCBonusEligible': {
        'task_type': 'TLC Bonus Eligibility',
        'name_prefix': 'Verify TLC Bonus Eligibility for',
        'assignedTo': 'HR/Payroll',
        'description': 'Review and confirm employee eligibility for TLC bonus program.',
        'short_code': '6',
        'to_email': 'yuanchichung@guardianfueltech.com',
        'to_phone': '19046767222', # ADDED
        'email_subject': 'Task: TLC Bonus Eligibility for {employee_full_name}',
        'email_body_template': 'Please verify TLC Bonus Eligibility for {employee_full_name} (Onboarding ID: {onboarding_id}). Manager: {manager}.',
        'sms_message_template': 'Task: TLC Bonus for {employee_full_name} (ID: {onboarding_id}). Manager: {manager}.' # ADDED
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
                # Prepare task details including specific email/phone if applicable
                new_task_details = {
                    'name': f"{config['name_prefix']} {employee_full_name}",
                    'description': f"{config['description']} (Onboarding ID: {onboarding_id})",
                    'task_type': task_type,
                    'assignedTo': config['assignedTo'],
                    'employee_full_name': employee_full_name,
                    'related_onboarding_id': onboarding_id,
                    'manager': manager_name,
                    'onboarding_id': onboarding_id # Redundant but explicit for templates
                }
                # Add specific contact info if available in config
                if 'to_email' in config:
                    new_task_details['to_email'] = config['to_email']
                if 'to_phone' in config:
                    new_task_details['to_phone'] = config['to_phone']

                add_task_to_db_list(onboarding_id, short_code, new_task_details)
                print(f"ACTION: New task '{new_task_details['name']}' created.")
                
                # Send email/SMS for each action
                if 'to_email' in config and 'email_subject' in config and 'email_body_template' in config:
                    email_subject = config['email_subject'].format(employee_full_name=employee_full_name)
                    email_body = config['email_body_template'].format(
                        employee_full_name=employee_full_name, 
                        onboarding_id=onboarding_id, 
                        manager=manager_name
                    )
                    # Assuming an email sending function `send_email_notification` exists or would be implemented.
                    # print(f"ACTION: EMAIL SENT to {config['to_email']} for '{task_type}' - Subject: '{email_subject}' - Body: '{email_body}'")
                    # Placeholder for actual email sending call
                    print(f"SIMULATING EMAIL: To: {config['to_email']}, Subject: {email_subject}, Body: {email_body}")
                
                # --- NEW SMS SENDING CALL ---
                if 'to_phone' in config and 'sms_message_template' in config:
                    sms_message = config['sms_message_template'].format(
                        employee_full_name=employee_full_name, 
                        onboarding_id=onboarding_id, 
                        manager=manager_name
                    )
                    send_sms_notification(config['to_phone'], sms_message)


            elif existing_task.get('Status') in ['N/A', 'Cancelled', 'Completed']:
                # Reset status to Open if it was previously closed and now requested
                update_task_in_db_list(existing_task, {'Status': 'Open', 'manager': manager_name}) 
                print(f"ACTION: Task '{existing_task.get('name')}' (ID: {existing_task.get('id')}) re-activated to 'Open'.")
                # Send notification for re-activation
                if 'to_email' in config and 'email_subject' in config and 'email_body_template' in config:
                    email_subject = f"Task Re-activated: {config['email_subject'].format(employee_full_name=employee_full_name)}"
                    email_body = f"The task '{existing_task.get('name')}' for {employee_full_name} (Onboarding ID: {onboarding_id}) has been re-activated to 'Open'. Manager: {manager_name}."
                    # print(f"ACTION: EMAIL SENT to {config['to_email']} for '{task_type}' re-activation - Subject: '{email_subject}' - Body: '{email_body}'")
                    print(f"SIMULATING EMAIL: To: {config['to_email']}, Subject: {email_subject}, Body: {email_body}")

                # # --- NEW SMS SENDING CALL --- exception give can try
                # if 'to_phone' in config and 'sms_message_template' in config:
                #     sms_message = f"Task Re-activated: '{existing_task.get('name')}' for {employee_full_name} (ID: {onboarding_id})."
                #     send_sms_notification(config['to_phone'], sms_message)

            elif existing_task.get('manager') != manager_name: 
                # Only update manager if it changed and task is already open
                update_task_in_db_list(existing_task, {'manager': manager_name})
                print(f"ACTION: Updated manager for task '{existing_task.get('name')}' (ID: {existing_task.get('id')}) to '{manager_name}'.")
                # Send notification for manager change
                if 'to_email' in config and 'email_subject' in config and 'email_body_template' in config:
                    email_subject = f"Manager Updated: {config['email_subject'].format(employee_full_name=employee_full_name)}"
                    email_body = f"The manager for task '{existing_task.get('name')}' for {employee_full_name} (Onboarding ID: {onboarding_id}) has been updated to {manager_name}."
                    # print(f"ACTION: EMAIL SENT to {config['to_email']} for '{task_type}' manager update - Subject: '{email_subject}' - Body: '{email_body}'")
                    print(f"SIMULATING EMAIL: To: {config['to_email']}, Subject: {email_subject}, Body: {email_body}")

                # --- NEW SMS SENDING CALL ---
                if 'to_phone' in config and 'sms_message_template' in config:
                    sms_message = f"Manager Updated: Task '{existing_task.get('name')}' for {employee_full_name} (ID: {onboarding_id}) to {manager_name}."
                    send_sms_notification(config['to_phone'], sms_message)

        else: # is_requested is False
            if existing_task and existing_task.get('Status') not in ['N/A', 'Cancelled', 'Completed']:
                # Mark as N/A if it was previously active but no longer requested
                update_task_in_db_list(existing_task, {'Status': 'N/A', 'description': existing_task['description'] + ' (No longer required)'})
                print(f"ACTION: Marked task '{existing_task.get('name')}' (ID: {existing_task.get('id')}) as N/A.")
                # Send notification for marking as N/A
                if 'to_email' in config and 'email_subject' in config and 'email_body_template' in config:
                    email_subject = f"Task Marked N/A: {config['email_subject'].format(employee_full_name=employee_full_name)}"
                    email_body = f"The task '{existing_task.get('name')}' for {employee_full_name} (Onboarding ID: {onboarding_id}) is no longer required and has been marked 'N/A'."
                    # print(f"ACTION: EMAIL SENT to {config['to_email']} for '{task_type}' marked N/A - Subject: '{email_subject}' - Body: '{email_body}'")
                    print(f"SIMULATING EMAIL: To: {config['to_email']}, Subject: {email_subject}, Body: {email_body}")

                # --- NEW SMS SENDING CALL ---
                if 'to_phone' in config and 'sms_message_template' in config:
                    sms_message = f"Task Marked N/A: '{existing_task.get('name')}' for {employee_full_name} (ID: {onboarding_id})."
                    send_sms_notification(config['to_phone'], sms_message)
    print("--- Task management complete ---")

def manage_tasks_after_submission_update(onboarding_id: int, new_submission_data: dict):
    """
    Orchestrates the addition, removal (by cancelling), and update of tasks
    based on a new or updated onboarding submission.
    """
    print(f"\n--- Managing tasks for Onboarding ID: {onboarding_id} ---")

    employee_full_name = f"{new_submission_data.get('LegalFirstName', '')} {new_submission_data.get('LegalLastName', '')}".strip()
    if not employee_full_name:
        print(f"Warning: Cannot manage tasks for Onboarding ID {onboarding_id} without employee name.")
        return

    # --- Section 1: Conditional Task Creation/Cancellation ---
    # Loop through each potential task type and its corresponding form field.

    # 1. Employee ID Task
    if new_submission_data.get('EmployeeID_Requested') == 'Yes': # Assuming 'Yes'/'No' for checkboxes
        task_type = "HR"
        short_code = "EID"
        task_name = "Request Employee ID"
        task_details = {
            "name": task_name,
            "description": new_submission_data.get('employeeID_RequestedDescription', ''), # From image_46adf4.jpg
            "task_type": task_type,
            "assignedTo": "HR/Payroll",
            "employee_full_name": employee_full_name,
            "related_onboarding_id": onboarding_id,
            "manager": new_submission_data.get('Manager', 'N/A'),
            "onboarding_id": onboarding_id,
            "to_email": "hr@example.com"
        }
        add_task_to_db_list(onboarding_id, short_code, task_details)
    else: # If Employee ID is no longer requested
        task_id_to_check = f"ONB-{onboarding_id}-EID"
        existing_task = find_task_by_id(task_id_to_check)
        if existing_task and existing_task.get('Status') not in ['Completed', 'Cancelled']: # Don't re-cancel or remove completed tasks
            print(f"Employee ID no longer requested. Cancelling task {task_id_to_check}.")
            update_task_in_db_list(existing_task, {'Status': 'Cancelled', 'CancellationReason': 'No longer requested in form update'})


    # 2. Purchasing Card Task
    if new_submission_data.get('PurchasingCard_Requested') == 'Yes': # Assuming 'Yes'/'No'
        task_type = "Finance"
        short_code = "PCARD"
        task_name = "Request Purchasing Card"
        task_details = {
            "name": task_name,
            "description": new_submission_data.get('purchasingCard_RequestedDescription', ''), # From image_46adf4.jpg
            "task_type": task_type,
            "assignedTo": "Finance",
            "employee_full_name": employee_full_name,
            "related_onboarding_id": onboarding_id,
            "manager": new_submission_data.get('Manager', 'N/A'),
            "onboarding_id": onboarding_id,
            "to_email": "finance@example.com"
        }
        add_task_to_db_list(onboarding_id, short_code, task_details)
    else:
        task_id_to_check = f"ONB-{onboarding_id}-PCARD"
        existing_task = find_task_by_id(task_id_to_check)
        if existing_task and existing_task.get('Status') not in ['Completed', 'Cancelled']:
            print(f"Purchasing Card no longer requested. Cancelling task {task_id_to_check}.")
            update_task_in_db_list(existing_task, {'Status': 'Cancelled', 'CancellationReason': 'No longer requested in form update'})


    # 3. Gas Card Task
    if new_submission_data.get('GasCard_Requested') == 'Yes': # Assuming 'Yes'/'No'
        task_type = "Fleet"
        short_code = "GCARD"
        task_name = "Request Gas Card"
        task_details = {
            "name": task_name,
            "description": new_submission_data.get('gasCard_RequestedDescription', ''), # From image_46adf4.jpg
            "task_type": task_type,
            "assignedTo": "Fleet Management",
            "employee_full_name": employee_full_name,
            "related_onboarding_id": onboarding_id,
            "manager": new_submission_data.get('Manager', 'N/A'),
            "onboarding_id": onboarding_id,
            "to_email": "fleet@example.com"
        }
        add_task_to_db_list(onboarding_id, short_code, task_details)
    else:
        task_id_to_check = f"ONB-{onboarding_id}-GCARD"
        existing_task = find_task_by_id(task_id_to_check)
        if existing_task and existing_task.get('Status') not in ['Completed', 'Cancelled']:
            print(f"Gas Card no longer requested. Cancelling task {task_id_to_check}.")
            update_task_in_db_list(existing_task, {'Status': 'Cancelled', 'CancellationReason': 'No longer requested in form update'})


    # 4. TLC Bonus Eligible Task
    if new_submission_data.get('TLCBonusEligible') == 'Yes': # Assuming 'Yes'/'No'
        task_type = "HR" # Or appropriate department
        short_code = "TLCBONUS"
        task_name = "Verify TLC Bonus Eligibility"
        task_details = {
            "name": task_name,
            "description": new_submission_data.get('tlcBonusEligibleDescription', ''), # From image_46adf4.jpg
            "task_type": task_type,
            "assignedTo": "HR/Payroll",
            "employee_full_name": employee_full_name,
            "related_onboarding_id": onboarding_id,
            "manager": new_submission_data.get('Manager', 'N/A'),
            "onboarding_id": onboarding_id,
            "to_email": "hr@example.com"
        }
        add_task_to_db_list(onboarding_id, short_code, task_details)
    else:
        task_id_to_check = f"ONB-{onboarding_id}-TLCBONUS"
        existing_task = find_task_by_id(task_id_to_check)
        if existing_task and existing_task.get('Status') not in ['Completed', 'Cancelled']:
            print(f"TLC Bonus no longer eligible. Cancelling task {task_id_to_check}.")
            update_task_in_db_list(existing_task, {'Status': 'Cancelled', 'CancellationReason': 'No longer eligible in form update'})


    # 5. Mobile Phone Task (Assuming a field like 'MobilePhone_Requested')
    if new_submission_data.get('MobilePhone_Requested') == 'Yes':
        task_type = "IT"
        short_code = "MOBILE"
        task_name = "Provide Mobile Phone"
        task_details = {
            "name": task_name,
            "description": new_submission_data.get('mobilePhone_RequestedDescription', ''),
            "task_type": task_type,
            "assignedTo": "IT",
            "employee_full_name": employee_full_name,
            "related_onboarding_id": onboarding_id,
            "manager": new_submission_data.get('Manager', 'N/A'),
            "onboarding_id": onboarding_id,
            "to_email": "it@example.com"
        }
        add_task_to_db_list(onboarding_id, short_code, task_details)
    else:
        task_id_to_check = f"ONB-{onboarding_id}-MOBILE"
        existing_task = find_task_by_id(task_id_to_check)
        if existing_task and existing_task.get('Status') not in ['Completed', 'Cancelled']:
            print(f"Mobile Phone no longer requested. Cancelling task {task_id_to_check}.")
            update_task_in_db_list(existing_task, {'Status': 'Cancelled', 'CancellationReason': 'No longer requested in form update'})


    # 6. VPN Access Task (Assuming a field like 'vpnAccess')
    if new_submission_data.get('vpnAccess') == 'Yes':
        task_type = "IT"
        short_code = "VPN"
        task_name = "Grant VPN Access"
        task_details = {
            "name": task_name,
            "description": "Provide VPN access to employee.",
            "task_type": task_type,
            "assignedTo": "IT",
            "employee_full_name": employee_full_name,
            "related_onboarding_id": onboarding_id,
            "manager": new_submission_data.get('Manager', 'N/A'),
            "onboarding_id": onboarding_id,
            "to_email": "it@example.com"
        }
        add_task_to_db_list(onboarding_id, short_code, task_details)
    else:
        task_id_to_check = f"ONB-{onboarding_id}-VPN"
        existing_task = find_task_by_id(task_id_to_check)
        if existing_task and existing_task.get('Status') not in ['Completed', 'Cancelled']:
            print(f"VPN access no longer requested. Cancelling task {task_id_to_check}.")
            update_task_in_db_list(existing_task, {'Status': 'Cancelled', 'CancellationReason': 'No longer requested in form update'})


    # 7. WiFi Domain Access Task (Assuming a field like 'wifiDomain')
    if new_submission_data.get('wifiDomain') == 'Yes': # Or if specific domain chosen
        task_type = "IT"
        short_code = "WIFI"
        task_name = "Grant WiFi Domain Access"
        task_details = {
            "name": task_name,
            "description": "Provide WiFi domain access to employee.",
            "task_type": task_type,
            "assignedTo": "IT",
            "employee_full_name": employee_full_name,
            "related_onboarding_id": onboarding_id,
            "manager": new_submission_data.get('Manager', 'N/A'),
            "onboarding_id": onboarding_id,
            "to_email": "it@example.com"
        }
        add_task_to_db_list(onboarding_id, short_code, task_details)
    else:
        task_id_to_check = f"ONB-{onboarding_id}-WIFI"
        existing_task = find_task_by_id(task_id_to_check)
        if existing_task and existing_task.get('Status') not in ['Completed', 'Cancelled']:
            print(f"WiFi Domain access no longer requested. Cancelling task {task_id_to_check}.")
            update_task_in_db_list(existing_task, {'Status': 'Cancelled', 'CancellationReason': 'No longer requested in form update'})


    # 8. Citrix Access Task (Assuming a field like 'citrixAccess')
    if new_submission_data.get('citrixAccess') == 'Yes':
        task_type = "IT"
        short_code = "CITRIX"
        task_name = "Grant Citrix Access"
        task_details = {
            "name": task_name,
            "description": "Provide Citrix access to employee.",
            "task_type": task_type,
            "assignedTo": "IT",
            "employee_full_name": employee_full_name,
            "related_onboarding_id": onboarding_id,
            "manager": new_submission_data.get('Manager', 'N/A'),
            "onboarding_id": onboarding_id,
            "to_email": "it@example.com"
        }
        add_task_to_db_list(onboarding_id, short_code, task_details)
    else:
        task_id_to_check = f"ONB-{onboarding_id}-CITRIX"
        existing_task = find_task_by_id(task_id_to_check)
        if existing_task and existing_task.get('Status') not in ['Completed', 'Cancelled']:
            print(f"Citrix access no longer requested. Cancelling task {task_id_to_check}.")
            update_task_in_db_list(existing_task, {'Status': 'Cancelled', 'CancellationReason': 'No longer requested in form update'})


    # 9. OP Access Task (Assuming a field like 'opAccess')
    if new_submission_data.get('opAccess') == 'Yes':
        task_type = "IT"
        short_code = "OPACC"
        task_name = "Grant OP Access"
        task_details = {
            "name": task_name,
            "description": "Provide OP access to employee.",
            "task_type": task_type,
            "assignedTo": "IT",
            "employee_full_name": employee_full_name,
            "related_onboarding_id": onboarding_id,
            "manager": new_submission_data.get('Manager', 'N/A'),
            "onboarding_id": onboarding_id,
            "to_email": "it@example.com"
        }
        add_task_to_db_list(onboarding_id, short_code, task_details)
    else:
        task_id_to_check = f"ONB-{onboarding_id}-OPACC"
        existing_task = find_task_by_id(task_id_to_check)
        if existing_task and existing_task.get('Status') not in ['Completed', 'Cancelled']:
            print(f"OP access no longer requested. Cancelling task {task_id_to_check}.")
            update_task_in_db_list(existing_task, {'Status': 'Cancelled', 'CancellationReason': 'No longer requested in form update'})


    # 10. Computer Task (Assuming a field like 'computer_Needed')
    if new_submission_data.get('computer_Needed') == 'Yes':
        task_type = "IT"
        short_code = "COMPUTER"
        task_name = "Order/Provide Computer"
        task_details = {
            "name": task_name,
            "description": "Order or provide computer for employee.",
            "task_type": task_type,
            "assignedTo": "IT",
            "employee_full_name": employee_full_name,
            "related_onboarding_id": onboarding_id,
            "manager": new_submission_data.get('Manager', 'N/A'),
            "onboarding_id": onboarding_id,
            "to_email": "it@example.com"
        }
        add_task_to_db_list(onboarding_id, short_code, task_details)
    else:
        task_id_to_check = f"ONB-{onboarding_id}-COMPUTER"
        existing_task = find_task_by_id(task_id_to_check)
        if existing_task and existing_task.get('Status') not in ['Completed', 'Cancelled']:
            print(f"Computer no longer needed. Cancelling task {task_id_to_check}.")
            update_task_in_db_list(existing_task, {'Status': 'Cancelled', 'CancellationReason': 'No longer needed in form update'})


    # 11. Shirt Task (Assuming a field like 'shirtIncludeSize')
    if new_submission_data.get('shirtIncludeSize'): # This field might hold the size or 'Yes'
        task_type = "HR" # Or Facilities/Ops
        short_code = "SHIRT"
        task_name = "Order Employee Shirt"
        task_details = {
            "name": task_name,
            "description": f"Order shirt for employee, size: {new_submission_data.get('shirtIncludeSize')}",
            "task_type": task_type,
            "assignedTo": "HR/Operations",
            "employee_full_name": employee_full_name,
            "related_onboarding_id": onboarding_id,
            "manager": new_submission_data.get('Manager', 'N/A'),
            "onboarding_id": onboarding_id,
            "to_email": "hr@example.com"
        }
        add_task_to_db_list(onboarding_id, short_code, task_details)
    else:
        task_id_to_check = f"ONB-{onboarding_id}-SHIRT"
        existing_task = find_task_by_id(task_id_to_check)
        if existing_task and existing_task.get('Status') not in ['Completed', 'Cancelled']:
            print(f"Shirt no longer requested. Cancelling task {task_id_to_check}.")
            update_task_in_db_list(existing_task, {'Status': 'Cancelled', 'CancellationReason': 'No longer requested in form update'})


    # 12. Email Distribution Lists (Admin/No Tech, Branch Manager, Sales, etc.)
    # For email lists, you might create one task per list if they go to different people/teams,
    # or one consolidated task for "Add to Email Lists". I'll use individual tasks for clarity.
    email_list_tasks = {
        'AdminNoTech': {'type': 'IT', 'code': 'EMAIL_ADMIN', 'name': 'Add to Admin/No Tech Email List', 'assign': 'IT', 'email': 'it@example.com'},
        'BranchManager': {'type': 'IT', 'code': 'EMAIL_BM', 'name': 'Add to Branch Manager Email List', 'assign': 'IT', 'email': 'it@example.com'},
        'Sales': {'type': 'IT', 'code': 'EMAIL_SALES', 'name': 'Add to Sales Email List', 'assign': 'IT', 'email': 'it@example.com'},
        'BranchTech': {'type': 'IT', 'code': 'EMAIL_BT', 'name': 'Add to Branch Tech Email List', 'assign': 'IT', 'email': 'it@example.com'},
        'PartsManager': {'type': 'IT', 'code': 'EMAIL_PM', 'name': 'Add to Parts Manager Email List', 'assign': 'IT', 'email': 'it@example.com'},
        'ServiceManager': {'type': 'IT', 'code': 'EMAIL_SM', 'name': 'Add to Service Manager Email List', 'assign': 'IT', 'email': 'it@example.com'},
        'TechGlobal': {'type': 'IT', 'code': 'EMAIL_TG', 'name': 'Add to Tech Global Email List', 'assign': 'IT', 'email': 'it@example.com'},
        'Global': {'type': 'IT', 'code': 'EMAIL_GLOBAL', 'name': 'Add to Global Email List', 'assign': 'IT', 'email': 'it@example.com'},
        'BranchDispatch': {'type': 'IT', 'code': 'EMAIL_BD', 'name': 'Add to Branch Dispatch Email List', 'assign': 'IT', 'email': 'it@example.com'}
    }

    for field_name, task_info in email_list_tasks.items():
        # Assuming the form field names match the keys in email_list_tasks (e.g., 'AdminNoTech' is a field in new_submission_data)
        if new_submission_data.get(field_name) == 'Yes': # Assuming 'Yes'/'No' checkbox value
            task_details = {
                "name": task_info['name'],
                "description": f"Add {employee_full_name} to the {task_info['name']} email distribution list.",
                "task_type": task_info['type'],
                "assignedTo": task_info['assign'],
                "employee_full_name": employee_full_name,
                "related_onboarding_id": onboarding_id,
                "manager": new_submission_data.get('Manager', 'N/A'),
                "onboarding_id": onboarding_id,
                "to_email": task_info['email']
            }
            add_task_to_db_list(onboarding_id, task_info['code'], task_details)
        else:
            task_id_to_check = f"ONB-{onboarding_id}-{task_info['code']}"
            existing_task = find_task_by_id(task_id_to_check)
            if existing_task and existing_task.get('Status') not in ['Completed', 'Cancelled']:
                print(f"Email list '{task_info['name']}' no longer requested. Cancelling task {task_id_to_check}.")
                update_task_in_db_list(existing_task, {'Status': 'Cancelled', 'CancellationReason': f'Email list {task_info["name"]} no longer requested'})


    # --- Section 2: Update existing tasks with changed submission data ---
    # This loop ensures that if core employee/onboarding details change in the submission,
    # the corresponding details are updated in *all* associated tasks.
    for task in tasks_db:
        if task.get('related_onboarding_id') == onboarding_id:
            task_updated_in_memory = False # Flag to track if any changes were made to this specific task

            # Update employee name if it changed
            if task.get('employee_full_name') != employee_full_name:
                task['employee_full_name'] = employee_full_name
                task_updated_in_memory = True
            # Update manager if it changed
            if task.get('manager') != new_submission_data.get('Manager'):
                task['manager'] = new_submission_data.get('Manager')
                task_updated_in_memory = True
            # Add more fields that tasks might depend on (e.g., new location, department if they are relevant task fields)
            # if task.get('location') != new_submission_data.get('Location'):
            #     task['location'] = new_submission_data.get('Location')
            #     task_updated_in_memory = True

            # If any part of the task was modified in memory, save it to JSON
            if task_updated_in_memory:
                # Call update_task_in_db_list which also updates 'updated_at' and saves to JSON
                update_task_in_db_list(task, task) # Pass the modified task object itself for update

    print(f"--- Task management complete for Onboarding ID: {onboarding_id} ---")

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
