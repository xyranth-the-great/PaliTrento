# React Native sets -DCMAKE_OBJECT_PATH_MAX=1024, which disables Windows path hashing.
# Setting it to 240 (> dir+md5+filename ~181, and < Windows MAX_PATH 260) makes CMake hash
# every object path over 240 chars down to ~181 chars.
set(CMAKE_OBJECT_PATH_MAX 240 CACHE STRING "Keep Windows Ninja object paths under MAX_PATH" FORCE)
