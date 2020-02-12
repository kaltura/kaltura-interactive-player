read -p 'enter tag (e.g v0.1.18): ' version;
echo Trying to push tag $version 
git tag -a $version -m \"$version\"
git push origin $version


