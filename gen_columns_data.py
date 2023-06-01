from os.path import join
from os import environ
import re

def get_columns(file_name):
    with open(file_name) as f:
        contents = f.read()
    # Remove actual comments
    contents = re.sub(r'\s*!#*\s.*', '', contents)
    # Remove horizontal lines
    contents = re.sub(r'\s*!-.*', '', contents)
    # Convert to list and strip all whitespace
    lines = [line.strip() for line in contents.split('\n')]
    return [line.lstrip('!') for line in lines if len(line) > 0]

def write_csv(input, output):
    headers = ['key', 'scale', 'html_name', 'html_units']
    with open(output, 'w') as f:
        print(','.join(headers), file=f)
        for column in get_columns(input):
            scale = 'linear'
            if column.lower()[:3] == 'log' or column.lower()[:2] == 'lg' or '_log' in column.lower() or '_lg' in column.lower():
                scale = 'log'
            print(','.join([column, scale] + [''] * (len(headers) - 2)), file=f)


if __name__ == "__main__":
    write_csv(join(environ['MESA_DIR'], 'star', 'defaults', 'profile_columns.list'), 'profile_columns.csv')
