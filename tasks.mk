clean:
	rm -Rf docs lib lib-cov tests/lib

watch: clean
	gulp watch

publish:
	npm publish

create-tag:
    git tag v$$(npm info . version) && git push origin v$$(npm info . version)
